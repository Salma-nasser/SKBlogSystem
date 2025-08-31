using FileBlogSystem.Models;

namespace FileBlogSystem.Services;

public interface ICommentService
{
    Task<Comment?> AddCommentAsync(string postSlug, string content, string authorUsername);
    Task<IEnumerable<Comment>> GetCommentsForPostAsync(string postSlug);
    Task<Comment?> GetCommentByIdAsync(string commentId);
    Task<bool> UpdateCommentAsync(string commentId, string newContent, string currentUsername);
    Task<bool> DeleteCommentAsync(string commentId, string currentUsername, bool isAdmin = false);
    Task<IEnumerable<Comment>> GetCommentsByUserAsync(string username);
    Task<int> GetCommentsCountForPostAsync(string postSlug);
    Task<IEnumerable<Comment>> GetAllCommentsAsync();
    Task<bool> ApproveCommentAsync(string commentId);
    Task<bool> RejectCommentAsync(string commentId);
}