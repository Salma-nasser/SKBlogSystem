using FileBlogSystem.Models;

namespace FileBlogSystem.Repositories.Interfaces
{
  public interface IPostRepository
  {
    // Read operations
    Task<IEnumerable<Post>> GetAllPostsAsync();
    Task<IEnumerable<Post>> GetPublishedPostsAsync();
    Task<Post?> GetPostBySlugAsync(string slug);
    Task<Post?> GetPostByIdAsync(string postId);
    Task<IEnumerable<Post>> GetPostsByUserAsync(string username);
    Task<IEnumerable<Post>> GetPostsByCategoryAsync(string category);
    Task<IEnumerable<Post>> GetPostsByTagAsync(string tag);
    Task<IEnumerable<Post>> GetDraftPostsByUserAsync(string username);

    // Write operations
    Task<string> CreatePostAsync(Post post);
    Task<bool> UpdatePostAsync(Post post);
    Task<bool> DeletePostAsync(string slug);
    Task<bool> PublishPostAsync(string slug);

    // Like operations
    Task<bool> LikePostAsync(string slug, string username);
    Task<bool> UnlikePostAsync(string slug, string username);
    Task<IEnumerable<string>> GetPostLikesAsync(string slug);

    // Helper operations
    Task<bool> PostExistsAsync(string slug);
    Task<string> GenerateUniqueSlugAsync(string baseSlug);
  }
}
