import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCursorIndexes1795503600000 implements MigrationInterface {
  name = 'AddCursorIndexes1795503600000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query('CREATE INDEX file_folder_cursor_idx ON file (folder_uuid, created_at DESC, uuid ASC)');
    await runner.query('CREATE INDEX folder_parent_cursor_idx ON folder (parent_uuid, created_at ASC, uuid ASC)');
  }

  async down(): Promise<void> {
    throw new Error('Cursor index rollback is not supported');
  }
}
