declare module "@prisma/client" {
  export class PrismaClient {
    $disconnect(): Promise<void>;
    [key: string]: any;
  }
}
