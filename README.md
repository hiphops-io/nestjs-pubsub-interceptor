# NestJS GCP Pub/Sub Interceptor

Provides an Interceptor for NestJS to automagically validate and unwrap HTTP push messages from Google Cloud Platform's Pub/Sub.

## Installation

`yarn add @hiphops/nestjs-pubsub-interceptor`

In addition to NestJS you'll also need to install the peer dependencies if you don't already have them:

`yarn add class-validator class-transformer rxjs`


## Why?

Pub/Sub messages pass the `data` field (the bit you probably care about) as a `base64` encoded string.
This is awkward when using push subscriptions to call endpoints in your app, as ideally we'd be able to validate the object/data inside the pub/sub message at the endpoint level and avoid boilerplate unwrapping logic for every call.

This interceptor does that for you. Decorating an endpoint like so:

```typescript
import { MessageDecodingInterceptor } from "@hiphops/nestjs-pubsub-interceptor";
// ...

@Controller()
export class AppController {
    constructor(private readonly appService: AppService) {}

    @Post()
    @UseInterceptors(MessageDecodingInterceptor)
    @UsePipes(new ValidationPipe({ transform: true }))
    handleTask(@Body() myPayload: MyPayloadDto) {
        // Log the unwrapped and validated payload
        console.log(myPayload);
    }
}
// ...
```

With the above, your push subscription can call your endpoint directly.
`MyPayloadDto` is a stand-in for any DTO object you might want to validate against. 
You receive the actual data you care about rather than a `base64` encoded string with all the other event dressing.
