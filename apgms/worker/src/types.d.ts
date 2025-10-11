declare module "dotenv" {
  const dotenv: {
    config(options?: { path?: string }): void;
  };
  export default dotenv;
}
