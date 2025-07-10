using FileBlogSystem.Models;
using System.Security.Claims;

namespace FileBlogSystem.Interfaces
{
    public interface IUserService
    {
        Task<IResult> LoginUser(string username, string password);
        Task<IResult> RegisterUser(string username, string password, string email, string role = "Author");
        Task<IResult> GetUserProfile(string username);
        Task<IResult> UpdateUserProfile(string username, UpdateProfileRequest formData);
        Task<IResult> UpdatePassword(string username, string currentPassword, string newPassword);
        bool IsAdmin(ClaimsPrincipal user);
        Task<IResult> PromoteUserToAdmin(string targetUsername, string requestedBy);
    }
}
