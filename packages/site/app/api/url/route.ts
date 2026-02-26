export const GET = () => {
  return new Response(process.env.CLIENT_SERVER_URL);
};
