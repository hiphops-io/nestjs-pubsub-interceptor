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

    // Allow validation exceptions to bubble up
    await validateOrReject(message);

    // Decode and parse into string
    const dataString = Buffer.from(message.data, "base64").toString();

    // Attempt to cast to JSON to enable validation of objects
    try {
      return JSON.parse(dataString);
    } catch {
      return dataString;
    }
  }

  private addAttributesToHeader(attributes: any, request: Request) {
    Object.keys(attributes).forEach((key) => {
      request.headers[`x-pubsub-${key}`] = attributes[key]
    })
  }

  private formatValidationError(error: ValidationError[]): Object {
    let errorPayload = {
      error: "Bad Request",
      statusCode: 400,
      message: [] as string[],
    }

    error.forEach((e) => {
      errorPayload.message.push(JSON.stringify(e));
    });

    return errorPayload;
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    // Get the message data from the request
    const request = context.switchToHttp().getRequest<Request>();

    try {
      // Now allow handlers to focus on the unwrapped/decoded body
      const message = await this.parseMessagePayload(request.body.message);
      this.addAttributesToHeader(request.body.message.attributes, request);
      request.body = message;
      return next.handle();
    } catch (e) {
      // We re-raise any non-validation errors as these are unhandled
      if (!(e instanceof Array && e[0] instanceof ValidationError)) throw e;

      // But if it was a validation error, let's intercept and return 400
      context.switchToHttp().getResponse().status(400);
      return of(this.formatValidationError(e));
    }
  }
}
