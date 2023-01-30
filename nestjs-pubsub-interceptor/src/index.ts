import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from "@nestjs/common";
import { Observable, of } from "rxjs";
import { MessageDto } from "./schema";
import { Request } from "express";
import { plainToInstance } from "class-transformer";
import { validateOrReject, ValidationError } from "class-validator";

export class InvalidObject extends BadRequestException {
  constructor(errorMessage: string) {
    super(errorMessage);
  }
}

@Injectable()
export class MessageDecodingInterceptor implements NestInterceptor {
  private async parseMessagePayload(messagePayload: object): Promise<string> {
    if (messagePayload === undefined)
      throw new InvalidObject(`Missing message field in request body`);
    if (!(messagePayload instanceof Object))
      throw new InvalidObject(`The message field has value: "${messagePayload}". This is not a valid object`);

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
    if (attributes === undefined || attributes === null) return;

    Object.keys(attributes).forEach((key) => {
      request.headers[`x-pubsub-${key}`] = attributes[key]
    })
  }

  private formatValidationError(error: ValidationError[] | InvalidObject): Object {
    let errorPayload = {
      error: "Bad Request",
      statusCode: 400,
      message: [] as string[],
    }

    if (error instanceof InvalidObject) {
      errorPayload.message.push(error.message);
    } else {
      error.forEach((e) => {
        errorPayload.message.push(JSON.stringify(e));
      });
    }

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
        // If it was a validation error, let's intercept and return 400
        if ((e instanceof Array && e[0] instanceof ValidationError) ||
          (e instanceof InvalidObject)
      ) {
        context.switchToHttp().getResponse().status(400);
        return of(this.formatValidationError(e));
      }

      // But we re-raise any non-validation errors as these are unhandled
      throw e;
    }
  }
}
