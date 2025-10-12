declare module "@prisma/client" {
  export class PrismaClient {
    $use(middleware: (...args: any[]) => any): void;
    [key: string]: any;
  }
}
