declare module "@prisma/client" {
  class PrismaClient {
    $connect(): Promise<void>;
    $disconnect(): Promise<void>;
    [key: string]: any;
  }

  export { PrismaClient };
}
