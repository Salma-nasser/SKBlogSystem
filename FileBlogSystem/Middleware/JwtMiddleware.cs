namespace FileBlogSystem.Middleware;

public class JwtMiddleware
{
    private readonly RequestDelegate _next;

    public JwtMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task Invoke(HttpContext context)
    {
        // You can inspect headers or log tokens here
        var token = context.Request.Headers["Authorization"].FirstOrDefault();
        Console.WriteLine($"🔐 Token received: {token}");

        await _next(context);
    }
}