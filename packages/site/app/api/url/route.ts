export const GET = () => {
  console.log(`Serving API URL: ${process.env.CLIENT_SERVER_URL}`);
  return new Response(process.env.CLIENT_SERVER_URL);
};
