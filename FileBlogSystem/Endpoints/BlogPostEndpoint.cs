using FileBlogSystem.Models;
using FileBlogSystem.Services;
using Microsoft.AspNetCore.Authorization;

namespace FileBlogSystem.Endpoints;

public static class BlogPostEndpoints
{
  public static void MapBlogPostEndpoints(this IEndpointRouteBuilder app)
  {
    app.MapGet("/api/posts", [Authorize] (BlogPostService service) =>
    {
      return Results.Ok(service.GetAllPosts());
    });

    app.MapPost("/api/posts/create", [Authorize] (CreatePostRequest request, HttpContext ctx, BlogPostService service) =>
    {
      // Example JWT-based user retrieval (adapt this to your auth setup)
      var userName = ctx.User.Identity?.Name;
      if (string.IsNullOrEmpty(userName))
        return Results.Unauthorized();

      var user = new User { Username = userName }; // Populate more if needed

      service.CreatePost(request, user);
      return Results.Created($"/api/posts/{request.CustomUrl}", null);
    });
  }
}