import * as fs from 'fs';
import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let msgPayload: any;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Construct a base message payload for the tests to send.
    const someDtoB64 = Buffer.from(
      '{"someString":"mystring", "someNumber":1}',
    ).toString('base64');

    msgPayload = {
      subscription: 'projects/a-gcp-project/subscriptions/test-pubsub-message',
      message: {
        data: someDtoB64,
        messageId: '1',
        attributes: {
          foo: 'bar',
        },
      },
    };
  });

  it('/task-request (POST) should handle b64 encoded messages', () => {
    return request(app.getHttpServer()).post('/').send(msgPayload).expect(201);
  });

  it('/task-request (POST) should return the correct string', () => {
    return request(app.getHttpServer())
      .post('/')
      .send(msgPayload)
      .expect(201)
      .expect('mystring');
  });

  it('/task-request (POST) should return 400 for non b64 encoding', () => {
    msgPayload.message.data = 'Some non-base64 string';

    return request(app.getHttpServer())
      .post('/')
      .send(msgPayload)
      .expect(400)
      .then((res) => {
        expect(res.body).toEqual(
          expect.objectContaining({
            error: 'Bad Request',
            message: [
              '{"target":{"data":"Some non-base64 string","messageId":"1","attributes":{"foo":"bar"}},"value":"Some non-base64 string","property":"data","children":[],"constraints":{"isBase64":"data must be base64 encoded"}}',
            ],
            statusCode: 400,
          }),
        );
      });
  });

  it('/task-request (POST) should return 400 for bad message format', () => {
    // Delete a required key
    delete msgPayload.message.data;

    return request(app.getHttpServer())
      .post('/')
      .send(msgPayload)
      .expect(400)
      .then((res) => {
        expect(res.body).toEqual(
          expect.objectContaining({
            error: 'Bad Request',
            message: [
              '{"target":{"messageId":"1","attributes":{"foo":"bar"}},"property":"data","children":[],"constraints":{"isBase64":"data must be base64 encoded"}}',
            ],
            statusCode: 400,
          }),
        );
      });
  });

  it('/task-request (POST) should return 400 for bad SomeDto format', () => {
    const badTaskContext = Buffer.from('{"foo":"bar"}').toString('base64');
    msgPayload.message.data = badTaskContext;

    return request(app.getHttpServer())
      .post('/')
      .send(msgPayload)
      .expect(400)
      .then((res) => {
        expect(res.body).toEqual(
          expect.objectContaining({
            error: 'Bad Request',
            message: [
              'someString must be a string',
              'someNumber must be a number conforming to the specified constraints',
            ],
            statusCode: 400,
          }),
        );
      });
  });

  it('/task-request (POST) should return 400 for empty payload', () => {
    return request(app.getHttpServer())
      .post('/')
      .send('')
      .expect(400)
      .then((res) => {
        expect(res.body).toEqual(
          expect.objectContaining({
            error: 'Bad Request',
            message: ['Missing message field in request body'],
            statusCode: 400,
          }),
        );
      });
  });

  it('/task-request (POST) should return 400 for empty object payload', () => {
    return request(app.getHttpServer())
      .post('/')
      .send({})
      .expect(400)
      .then((res) => {
        expect(res.body).toEqual(
          expect.objectContaining({
            error: 'Bad Request',
            message: ['Missing message field in request body'],
            statusCode: 400,
          }),
        );
      });
  });

  it('/task-request (POST) should return 400 for string message payload', () => {
    msgPayload.message = 'a string';

    return request(app.getHttpServer())
      .post('/')
      .send(msgPayload)
      .expect(400)
      .then((res) => {
        expect(res.body).toEqual(
          expect.objectContaining({
            error: 'Bad Request',
            message: [
              'The message field has value: "a string". This is not a valid object',
            ],
            statusCode: 400,
          }),
        );
      });
  });

  it('/task-request (POST) should return 201 with no attributes', () => {
    msgPayload.message.attributes = {};
    return request(app.getHttpServer())
      .post('/headers')
      .send(msgPayload)
      .expect(201);
  });

  it('/task-request (POST) should return 201 with null attributes', () => {
    msgPayload.message.attributes = null;
    return request(app.getHttpServer())
      .post('/headers')
      .send(msgPayload)
      .expect(201);
  });

  it('/task-request (POST) should return 201 with missing attributes', () => {
    delete msgPayload.message.attributes;
    return request(app.getHttpServer())
      .post('/headers')
      .send(msgPayload)
      .expect(201);
  });

  it('/task-request (POST) should add header based on attributes', (done) => {
    request(app.getHttpServer())
      .post('/headers')
      .send(msgPayload)
      .expect(201)
      .end(function (err, res) {
        expect(res.body['x-pubsub-foo']).toBe('bar');
        done();
      });
  });
});
