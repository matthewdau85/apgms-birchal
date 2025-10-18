import type { FastifyInstance } from "fastify";

interface TestResponse {
  status: number;
  body: any;
  headers: Record<string, any>;
}

class SuperTest {
  private method: string = "GET";
  private url = "/";
  private headers: Record<string, string> = {};
  private payload: any;
  private promise: Promise<TestResponse> | null = null;

  constructor(private readonly app: FastifyInstance) {}

  get(url: string) {
    this.method = "GET";
    this.url = url;
    return this;
  }

  post(url: string) {
    this.method = "POST";
    this.url = url;
    return this;
  }

  set(header: string, value: string) {
    this.headers[header.toLowerCase()] = value;
    return this;
  }

  send(body: any) {
    this.payload = body;
    if (!this.headers["content-type"]) {
      this.headers["content-type"] = "application/json";
    }
    return this.execute();
  }

  then<TResult1 = TestResponse, TResult2 = never>(onfulfilled?: ((value: TestResponse) => TResult1 | Promise<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | null) {
    return this.execute().then(onfulfilled as any, onrejected as any);
  }

  catch<TResult = never>(onrejected?: (reason: any) => TResult | Promise<TResult>) {
    return this.execute().catch(onrejected);
  }

  finally(onfinally?: () => void) {
    return this.execute().finally(onfinally);
  }

  private async execute(): Promise<TestResponse> {
    if (!this.promise) {
      const response = await this.app.inject({
        method: this.method,
        url: this.url,
        headers: this.headers,
        payload: this.payload !== undefined ? JSON.stringify(this.payload) : undefined,
      });
      const contentType = response.headers["content-type"] ?? "";
      const body = contentType.includes("application/json") && response.payload
        ? JSON.parse(response.payload)
        : response.payload;
      this.promise = Promise.resolve({
        status: response.statusCode,
        body,
        headers: response.headers,
      });
    }
    return this.promise;
  }
}

export default function request(app: FastifyInstance) {
  return new SuperTest(app);
}
