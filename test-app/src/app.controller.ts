import {
  Body,
  Controller,
  Post,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
  Headers,
} from '@nestjs/common';
import { AppService } from './app.service';
import { MessageDecodingInterceptor } from '@hiphops/nestjs-pubsub-interceptor';
import { IsNumber, IsString } from 'class-validator';

class SomeDto {
  @IsString()
  someString: string;
  @IsNumber()
  someNumber: number;
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post()
  @UseInterceptors(MessageDecodingInterceptor)
  @UsePipes(new ValidationPipe({ transform: true }))
  root(@Body() someObject: SomeDto): string {
    return someObject.someString;
  }

  @Post('headers')
  @UseInterceptors(MessageDecodingInterceptor)
  @UsePipes(new ValidationPipe({ transform: true }))
  headers(@Headers() headers): string {
    return headers;
  }
}
