import { CursorQueryDto } from '@sellgar/pagination';
import { IsUUID, ValidateIf } from 'class-validator';

import { GetAllFilesQuery } from '../../service/query/get-all-files.query';

export class GetAllFilesDto extends CursorQueryDto implements GetAllFilesQuery {
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  folderUuid?: string;
}
