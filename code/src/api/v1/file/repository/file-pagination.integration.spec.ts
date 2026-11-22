import 'reflect-metadata';

import { CursorPagination } from '@sellgar/pagination';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

import { FileDatabaseOptions } from '../../../../database/file-database.options';
import { FolderRepository } from '../../folder/repository/folder.repository';
import { FileRepository } from './file.repository';
import { FileService } from '../service/file.service';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';

const databaseTests = process.env.FILE_PAGINATION_DATABASE_TESTS === '1' ? describe : describe.skip;

databaseTests('File and folder cursor pages in isolated PostgreSQL', () => {
  const schema = 'file_page_test_' + randomUUID().replace(/-/g, '');
  const folderUuid = randomUUID();
  const otherFolderUuid = randomUUID();
  const ids = Array.from({ length: 5 }, () => randomUUID()).sort();
  const deletedUuid = randomUUID();
  let source: DataSource;
  let files: FileRepository;
  let folders: FolderRepository;

  beforeAll(async () => {
    const options = FileDatabaseOptions.create(process.env);
    if (options.type !== 'postgres') throw new Error('PostgreSQL is required');
    const control = await new DataSource({ ...options, entities: [], migrations: [] }).initialize();
    await control.query(`CREATE SCHEMA "${schema}"`);
    await control.destroy();
    source = await new DataSource({
      ...options,
      schema,
      extra: { options: `-c search_path=${schema},public` },
    }).initialize();
    await source.runMigrations();
    const pagination = new CursorPagination('test-pagination-key-at-least-32-bytes');
    files = new FileRepository(source, pagination);
    folders = new FolderRepository(source, pagination);
    await source.query(`INSERT INTO folder(uuid,name) VALUES ($1,'One'),($2,'Two')`, [folderUuid, otherFolderUuid]);
    for (const uuid of ids) {
      await source.query(
        `INSERT INTO file(uuid,name,storage_key,mime,size,folder_uuid,created_at)
         VALUES($1,'Photo',$3,'image/png',12,$2,'2026-11-22 12:00:00.123456')`,
        [uuid, folderUuid, uuid],
      );
    }
    await source.query(
      `INSERT INTO file(uuid,name,storage_key,mime,size,folder_uuid,status,created_at)
       VALUES($1,'Deleted',$3,'image/png',12,$2,'deleted','2026-11-23')`,
      [deletedUuid, folderUuid, deletedUuid],
    );
    await source.query(
      `INSERT INTO file(name,storage_key,mime,size,folder_uuid) VALUES('Other','other','image/png',12,$1)`,
      [otherFolderUuid],
    );
  });

  afterAll(async () => {
    if (source?.isInitialized) {
      await source.query(`DROP SCHEMA "${schema}" CASCADE`);
      await source.destroy();
    }
  });

  it('walks equal timestamps without crossing a folder boundary', async () => {
    const seen: string[] = [];
    let nextToken: string | undefined;
    do {
      const page = await files.getAll({ folderUuid, limit: 2, nextToken });
      expect(page.items.length).toBeLessThanOrEqual(2);
      seen.push(...page.items.map((file) => file.uuid));
      if (page.meta.nextToken === null) break;
      nextToken = page.meta.nextToken;
    } while (true);
    expect(seen).toEqual(ids);
    const first = await files.getAll({ folderUuid, limit: 2 });
    await expect(files.getAll({ folderUuid: otherFolderUuid, nextToken: first.meta.nextToken! })).rejects.toMatchObject(
      { status: 400 },
    );
  });

  it('paginates root folders and returns an explicit end for an empty folder', async () => {
    const first = await folders.findAll({ limit: 1 });
    const second = await folders.findAll({ limit: 1, nextToken: first.meta.nextToken! });
    expect(new Set([...first.items, ...second.items].map((folder) => folder.uuid))).toEqual(
      new Set([folderUuid, otherFolderUuid]),
    );
    expect(second.meta.nextToken).toBeNull();
    expect(await files.getAll({ folderUuid: randomUUID() })).toEqual({
      items: [],
      meta: { limit: 50, nextToken: null },
    });
  });

  it('hides deleted metadata from ordinary lookup and preserves idempotent cleanup', async () => {
    expect(await files.findByUuid(deletedUuid)).toBeNull();
    const media = { send: jest.fn() };
    const service = new FileService({} as ConfigService, files, {} as ClientProxy, media as unknown as ClientProxy);
    await expect(service.getMetadataByUuid(deletedUuid)).rejects.toMatchObject({ status: 404 });
    expect((await service.deleteByUuid(deletedUuid)).status).toBe('deleted');
    expect(media.send).not.toHaveBeenCalled();
    expect((await files.updateUploadState(ids[0], { status: 'deleted' }))?.status).toBe('deleted');
    expect(await files.findByUuid(ids[0])).toBeNull();
    expect((await files.findForDeletion(ids[0]))?.status).toBe('deleted');
  });
});
