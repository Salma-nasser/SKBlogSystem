using FileBlogSystem.Models;

namespace FileBlogSystem.Interfaces
{
    public interface IAdminService
    {
        Task<IResult> PromoteUserToAdmin(string targetUsername, string requestedBy);
        Task<IResult> GetAllUsers();
    }
}
