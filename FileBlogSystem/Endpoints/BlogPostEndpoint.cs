namespace FileBlogSystem.Endpoints;

public static class PostsEndpoint
{
  public static void MapPostsEndpoints(this WebApplication app)
  {
    var PostsGroup = app.MapGroup("/posts");
    PostsGroup.MapGet("", GetPosts);
  }
  private static Task<IResult> GetPosts()
  {
    return Task.FromResult<IResult>(Results.Ok(new List<string> { "Post1", "Post2" }));
  }

  private static Task<IResult> CreatePost()
  {
    // Logic to create a new post
    return Task.FromResult<IResult>(Results.Created("/posts/1", new { Id = 1, Title = "New Post" })); ;
  }
}