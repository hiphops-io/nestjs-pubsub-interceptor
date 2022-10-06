import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable, of } from "rxjs";
import { MessageDto } from "./schema";
import { Request } from "express";
import { plainToInstance } from "class-transformer";
import { validateOrReject, ValidationError } from "class-validator";

@Injectable()
export class MessageDecodingInterceptor implements NestInterceptor {
  private async parseMessagePayload(messagePayload: any): Promise<string> {
    const message = plainToInstance(MessageDto, messagePayload);
    try {
      await validateOrReject(message);
    } catch (e) {
      throw new ValidationError();
    }

    // Decode and parse into string
    const dataString = Buffer.from(message.data, "base64").toString();

    // Attempt to cast to JSON to enable validation of objects
    try {
      return JSON.parse(dataString);
    } catch {
      return dataString;
    }
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    // Get the message data from the request
    const request = context.switchToHttp().getRequest<Request>();

    try {
      // Now allow handlers to focus on the unwrapped/decoded body
      request.body = await this.parseMessagePayload(request.body.message);
      return next.handle();
    } catch (e) {
      // We re-raise any non-validation errors as these are unhandled
      if (!(e instanceof ValidationError)) throw e;

      // But if it was a validation error, let's intercept and return 400
      context.switchToHttp().getResponse().status(400);
      return of([]);
    }
  }
}
