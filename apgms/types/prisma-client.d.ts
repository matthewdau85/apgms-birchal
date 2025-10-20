declare module "@prisma/client" {
  export class PrismaClient {
    [key: string]: any;
  }
  const PrismaClientDefault: typeof PrismaClient;
  export default PrismaClientDefault;
}
