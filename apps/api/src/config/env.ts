// Development uses port 4000, production Electron uses port 41923
// The port can be overridden via PORT environment variable
export const env = {
  port: Number(process.env.PORT ?? 4000)
};
