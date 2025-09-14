using FileBlogSystem.Models;

namespace FileBlogSystem.Repositories.Interfaces
{
  public interface ICommentRepository
  {
    // Read operations
    Task<IEnumerable<Comment>> GetCommentsByPostSlugAsync(string postSlug);
    Task<Comment?> GetCommentByIdAsync(string commentId);
    Task<IEnumerable<Comment>> GetCommentsByUserAsync(string username);
    Task<IEnumerable<Comment>> GetAllCommentsAsync();

    // Write operations
    Task<string> CreateCommentAsync(string postSlug, Comment comment);
    Task<bool> UpdateCommentAsync(string postSlug, Comment comment);
    Task<bool> DeleteCommentAsync(string commentId);

    // Helper operations
    Task<bool> CommentExistsAsync(string commentId);
    Task<int> GetCommentsCountByPostSlugAsync(string postSlug);
  }
}
