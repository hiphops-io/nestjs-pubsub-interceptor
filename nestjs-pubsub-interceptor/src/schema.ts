import { IsBase64 } from "class-validator";

export class MessageDto {
  type: string;

  attributes: Map<string, string>;

  @IsBase64()
  data: string;
}
