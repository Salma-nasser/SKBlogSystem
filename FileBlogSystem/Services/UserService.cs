using System.Security.Claims;
using FileBlogSystem.Models;
using FileBlogSystem.Interfaces;
using FileBlogSystem.Repositories.Interfaces;
using FileBlogSystem.Services;

namespace FileBlogSystem.Services;

public class UserService : IUserService
{
    private readonly IUserRepository _userRepository;
    private readonly PasswordService _passwordService;
    private readonly JwtService _jwtService;
    private readonly ILogger<UserService> _logger;

    public UserService(
        IUserRepository userRepository,
        PasswordService passwordService,
        JwtService jwtService,
        ILogger<UserService> logger)
    {
        _userRepository = userRepository;
        _passwordService = passwordService;
        _jwtService = jwtService;
        _logger = logger;
    }

    public async Task<IResult> LoginUser(string username, string password)
    {
        try
        {
            var user = await _userRepository.GetUserByUsernameAsync(username);
            if (user == null)
            {
                return Results.Unauthorized();
            }

            if (!user.IsActive)
            {
                return Results.BadRequest("Account is deactivated");
            }

            // Verify password
            if (!_passwordService.VerifyPassword(password, user.PasswordHash))
            {
                return Results.Unauthorized();
            }

            // Generate JWT token
            var token = _jwtService.GenerateToken(user);

            return Results.Ok(new
            {
                token,
                username = user.Username,
                role = user.Role,
                message = "Login successful"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during login for user: {Username}", username);
            return Results.Problem("Login failed", statusCode: StatusCodes.Status500InternalServerError);
        }
    }

    public async Task<IResult> RegisterUser(string username, string password, string email, string role = "Author")
    {
        try
        {
            // Check if username already exists
            if (await _userRepository.UserExistsAsync(username))
            {
                return Results.BadRequest("Username already exists");
            }

            // Check if email already exists
            if (await _userRepository.EmailExistsAsync(email))
            {
                return Results.BadRequest("Email already exists");
            }

            // Hash password
            string passwordHash = _passwordService.HashPassword(password);

            // Create user
            var user = new User
            {
                Username = username,
                Email = email,
                PasswordHash = passwordHash,
                Role = role,
                CreatedAt = DateTime.UtcNow,
                IsActive = true,
                Bio = string.Empty,
                ProfilePictureUrl = string.Empty
            };

            bool success = await _userRepository.CreateUserAsync(user);
            if (!success)
            {
                return Results.Problem("Failed to create user", statusCode: StatusCodes.Status500InternalServerError);
            }

            // Generate JWT token
            var token = _jwtService.GenerateToken(user);

            return Results.Ok(new
            {
                token,
                username = user.Username,
                role = user.Role,
                message = "Registration successful"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during registration for user: {Username}", username);
            return Results.Problem("Registration failed", statusCode: StatusCodes.Status500InternalServerError);
        }
    }

    public async Task<IResult> GetUserProfile(string username, string? requestingUser = null)
    {
        try
        {
            var user = await _userRepository.GetUserByUsernameAsync(username);
            if (user == null)
            {
                return Results.NotFound("User not found");
            }

            if (!user.IsActive && (requestingUser == null || !requestingUser.Equals(username, StringComparison.OrdinalIgnoreCase)))
            {
                return Results.NotFound("User not found");
            }

            // Return profile (exclude sensitive data)
            var profile = new
            {
                user.Username,
                user.Email,
                user.Role,
                user.CreatedAt,
                user.Bio,
                user.ProfilePictureUrl,
                user.IsActive,
                user.PublishedPostsCount
            };

            return Results.Ok(profile);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting user profile: {Username}", username);
            return Results.Problem("Failed to get user profile", statusCode: StatusCodes.Status500InternalServerError);
        }
    }

    public async Task<IResult> UpdateUserProfile(string username, UpdateProfileRequest formData)
    {
        try
        {
            var user = await _userRepository.GetUserByUsernameAsync(username);
            if (user == null)
            {
                return Results.NotFound("User not found");
            }

            // Check if new email is already taken by another user
            if (!string.IsNullOrEmpty(formData.Email) &&
                !formData.Email.Equals(user.Email, StringComparison.OrdinalIgnoreCase))
            {
                if (await _userRepository.EmailExistsAsync(formData.Email))
                {
                    return Results.BadRequest("Email already exists");
                }
            }

            bool success = await _userRepository.UpdateProfileAsync(username, formData);
            if (!success)
            {
                return Results.Problem("Failed to update profile", statusCode: StatusCodes.Status500InternalServerError);
            }

            return Results.Ok(new { message = "Profile updated successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating user profile: {Username}", username);
            return Results.Problem("Failed to update profile", statusCode: StatusCodes.Status500InternalServerError);
        }
    }

    public async Task<IResult> UpdatePassword(string username, string currentPassword, string newPassword)
    {
        try
        {
            var user = await _userRepository.GetUserByUsernameAsync(username);
            if (user == null)
            {
                return Results.NotFound("User not found");
            }

            // Verify current password
            if (!_passwordService.VerifyPassword(currentPassword, user.PasswordHash))
            {
                return Results.BadRequest("Current password is incorrect");
            }

            // Hash new password
            string newPasswordHash = _passwordService.HashPassword(newPassword);

            bool success = await _userRepository.UpdatePasswordAsync(username, newPasswordHash);
            if (!success)
            {
                return Results.Problem("Failed to update password", statusCode: StatusCodes.Status500InternalServerError);
            }

            return Results.Ok(new { message = "Password updated successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating password for user: {Username}", username);
            return Results.Problem("Failed to update password", statusCode: StatusCodes.Status500InternalServerError);
        }
    }

    public bool IsAdmin(ClaimsPrincipal user)
    {
        var role = user.FindFirst(ClaimTypes.Role)?.Value;
        return role?.Equals("Admin", StringComparison.OrdinalIgnoreCase) == true;
    }

    public async Task<IResult> DeleteUser(string username)
    {
        try
        {
            bool success = await _userRepository.DeleteUserAsync(username);
            if (!success)
            {
                return Results.NotFound("User not found");
            }

            return Results.Ok(new { message = "User deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting user: {Username}", username);
            return Results.Problem("Failed to delete user", statusCode: StatusCodes.Status500InternalServerError);
        }
    }

    public async Task<IResult> VerifyOtp(string username, string otpCode)
    {
        try
        {
            bool isValid = await _userRepository.IsOtpValidAsync(username, otpCode);
            if (!isValid)
            {
                return Results.BadRequest("Invalid or expired OTP");
            }

            // Clear the OTP after successful verification
            await _userRepository.ClearOtpAsync(username);

            return Results.Ok(new { message = "OTP verified successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error verifying OTP for user: {Username}", username);
            return Results.Problem("Failed to verify OTP", statusCode: StatusCodes.Status500InternalServerError);
        }
    }

    public async Task<IResult> ResetPassword(string username, string newPassword)
    {
        try
        {
            var user = await _userRepository.GetUserByUsernameAsync(username);
            if (user == null)
            {
                return Results.NotFound("User not found");
            }

            // Hash new password
            string newPasswordHash = _passwordService.HashPassword(newPassword);

            bool success = await _userRepository.UpdatePasswordAsync(username, newPasswordHash);
            if (!success)
            {
                return Results.Problem("Failed to reset password", statusCode: StatusCodes.Status500InternalServerError);
            }

            // Clear any existing OTP
            await _userRepository.ClearOtpAsync(username);

            return Results.Ok(new { message = "Password reset successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resetting password for user: {Username}", username);
            return Results.Problem("Failed to reset password", statusCode: StatusCodes.Status500InternalServerError);
        }
    }

    public async Task<IResult> ForgotPassword(string username, string email, EmailService emailService)
    {
        try
        {
            var user = await _userRepository.GetUserByUsernameAsync(username);
            if (user == null || !user.Email.Equals(email, StringComparison.OrdinalIgnoreCase))
            {
                // Return success even if user doesn't exist to prevent username enumeration
                return Results.Ok(new { message = "If the account exists, a reset code has been sent" });
            }

            // Generate OTP
            string otpCode = GenerateOtp();
            DateTime expiry = DateTime.UtcNow.AddMinutes(15); // OTP expires in 15 minutes

            bool success = await _userRepository.SaveOtpAsync(username, otpCode, expiry);
            if (!success)
            {
                return Results.Problem("Failed to generate reset code", statusCode: StatusCodes.Status500InternalServerError);
            }

            // Send email (implement email service)
            // await emailService.SendOtpEmail(email, otpCode);

            return Results.Ok(new { message = "If the account exists, a reset code has been sent" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in forgot password for user: {Username}", username);
            return Results.Problem("Failed to process forgot password request", statusCode: StatusCodes.Status500InternalServerError);
        }
    }

    // Private helper methods
    private string GenerateOtp()
    {
        var random = new Random();
        return random.Next(100000, 999999).ToString();
    }
}
