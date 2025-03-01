import { Type } from "class-transformer";
import { IsBoolean, IsOptional } from "class-validator";

export class DiscordConnectionFormatterOptions {
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  formatTables?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  stripImages: boolean;
}
