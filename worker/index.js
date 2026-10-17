export default {
  async fetch(request) {
    if (request.method === "GET") {
      return Response.json({
        app: "ATWORK",
        status: "online",
        message: "Worker is running"
      });
    }

    if (request.method === "POST") {
      return new Response("OK", {
        status: 200
      });
    }

    return new Response("Method Not Allowed", {
      status: 405
    });
  }
};
