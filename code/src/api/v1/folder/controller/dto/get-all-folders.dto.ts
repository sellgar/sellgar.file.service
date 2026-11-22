import { CursorQueryDto } from '@sellgar/pagination';
import { IsUUID, ValidateIf } from 'class-validator';

import { GetAllFoldersQuery } from '../../service/query/get-all-folders.query';

export class GetAllFoldersDto extends CursorQueryDto implements GetAllFoldersQuery {
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  parentUuid?: string;
}
