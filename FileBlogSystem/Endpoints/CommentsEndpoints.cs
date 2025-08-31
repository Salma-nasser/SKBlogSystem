using FileBlogSystem.Models;
using FileBlogSystem.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.IO;
using System.Collections.Generic;

namespace FileBlogSystem.Endpoints;

public static class CommentsEndpoints
{
  public static void MapCommentsEndpoints(this IEndpointRouteBuilder app)
  {
    var commentsGroup = app.MapGroup("/api/posts/{postId}/comments")
                           .WithTags("Comments")
                           .RequireAuthorization();

    // GET: retrieve all comments for a post
    commentsGroup.MapGet("/", async (string postId, ICommentService commentService) =>
    {
      if (string.IsNullOrWhiteSpace(postId) || postId.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0)
        return Results.BadRequest(new { message = "Invalid post ID." });
      var comments = await commentService.GetCommentsForPostAsync(postId);
      return Results.Ok(comments);
    })
    .WithName("GetComments")
    .Produces<List<Comment>>(StatusCodes.Status200OK)
    .Produces(StatusCodes.Status400BadRequest);

    // POST: add a new comment
    commentsGroup.MapPost("/", async (
        string postId,
        [FromBody] AddCommentDto commentDto,
        ICommentService commentService,
        HttpContext context) =>
    {
      // Validate postId and comment content to prevent injections and empty input
      if (string.IsNullOrWhiteSpace(postId) || postId.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0)
      {
        return Results.BadRequest(new { message = "Invalid post ID." });
      }
      if (commentDto == null || string.IsNullOrWhiteSpace(commentDto.Content))
      {
        return Results.BadRequest(new { message = "Content cannot be empty." });
      }
      var username = context.User.Identity?.Name;
      if (string.IsNullOrEmpty(username))
      {
        return Results.Unauthorized();
      }

      var newComment = await commentService.AddCommentAsync(postId, commentDto.Content, username);

      if (newComment == null)
      {
        return Results.NotFound(new { message = "Post not found." });
      }

      return Results.Created($"/api/posts/{postId}/comments/{newComment.Id}", newComment);
    })
    .WithName("AddCommentToPost")
    .Produces<Comment>(StatusCodes.Status201Created)
    .Produces(StatusCodes.Status401Unauthorized)
    .Produces(StatusCodes.Status404NotFound);
  }
}