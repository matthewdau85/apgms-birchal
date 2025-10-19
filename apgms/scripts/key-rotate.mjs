import crypto from "node:crypto";

const secret = crypto.randomBytes(48).toString("hex");

console.log(`JWT_SECRET=${secret}`);
console.log("Copy the value above into your environment configuration and redeploy the service.");
