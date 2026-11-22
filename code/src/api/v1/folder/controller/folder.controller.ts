import { Body, Controller, Delete, Get, Patch, Post, Query, Param } from '@nestjs/common';

import { GetAllFoldersDto } from './dto/get-all-folders.dto';
import { FolderService } from '../service/folder.service';
import { CreateFolderDto } from '../repository/dto/create-folder.dto';
import { UpdateFolderDto } from '../repository/dto/update-folder.dto';

@Controller('v1/folders')
export class FolderController {
  constructor(private readonly folderService: FolderService) {}

  @Get(':uuid')
  findByUuid(@Param('uuid') uuid: string) {
    return this.folderService.findByUuid(uuid);
  }

  @Get()
  findAll(@Query() query: GetAllFoldersDto) {
    return this.folderService.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateFolderDto) {
    return this.folderService.create(dto);
  }

  @Patch(':uuid')
  update(@Param('uuid') uuid: string, @Body() dto: UpdateFolderDto) {
    return this.folderService.update(uuid, dto);
  }

  @Delete(':uuid')
  remove(@Param('uuid') uuid: string) {
    return this.folderService.remove(uuid);
  }
}
