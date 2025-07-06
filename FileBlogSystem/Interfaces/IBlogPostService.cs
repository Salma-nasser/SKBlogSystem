using FileBlogSystem.Models;

namespace FileBlogSystem.Interfaces
{
    public interface IBlogPostService
    {
        IEnumerable<Post> GetAllPosts();
        IEnumerable<Post> GetPostsByCategory(string category);
        IEnumerable<Post> GetPostsByTag(string tag);
        Post? GetPostBySlug(string slug);
        IEnumerable<Post> GetUserDrafts(string username);
        Task<dynamic> CreatePostAsync(CreatePostRequest request, string authorUsername);
        Task<(bool Success, string Message)> ModifyPostAsync(string slug, CreatePostRequest updatedData, string currentUsername);
        Task<(bool Success, string Message)> PublishPostAsync(string slug, string currentUsername);
        Task<bool> DeletePostAsync(string slug);
        IEnumerable<Post> GetAllPostsIncludingDrafts();

        IEnumerable<Post> GetPostsByUser(string username);
        
    }
}
