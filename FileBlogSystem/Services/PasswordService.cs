using System.Security.Cryptography;
using System.Text;
using FileBlogSystem.Models;

namespace FileBlogSystem.Services;

public class PasswordService
{
    private const int SaltSize = 16;
    private const int HashSize = 32;
    private const int Iterations = 10000;

    private readonly TimeSpan ResetTokenLifetime = TimeSpan.FromMinutes(15);

    // Generate a hashed password with a random salt
    public string HashPassword(string password)
    {
        byte[] salt = RandomNumberGenerator.GetBytes(SaltSize);
        byte[] hash = ComputeHash(password, salt);

        byte[] combinedHash = new byte[SaltSize + HashSize];
        Buffer.BlockCopy(salt, 0, combinedHash, 0, SaltSize);
        Buffer.BlockCopy(hash, 0, combinedHash, SaltSize, HashSize);

        return Convert.ToBase64String(combinedHash);
    }

    // Verify a password against a stored hash
    public bool VerifyPassword(string password, string storedHash)
    {
        byte[] combinedHash = Convert.FromBase64String(storedHash);

        byte[] salt = new byte[SaltSize];
        byte[] originalHash = new byte[HashSize];
        Buffer.BlockCopy(combinedHash, 0, salt, 0, SaltSize);
        Buffer.BlockCopy(combinedHash, SaltSize, originalHash, 0, HashSize);

        byte[] newHash = ComputeHash(password, salt);

        return CryptographicOperations.FixedTimeEquals(originalHash, newHash);
    }

    private byte[] ComputeHash(string password, byte[] salt)
    {
        return Rfc2898DeriveBytes.Pbkdf2(
            password,
            salt,
            Iterations,
            HashAlgorithmName.SHA256,
            HashSize
        );
    }

    // ✅ Generate and store reset token on the user
    public string GenerateAndStoreResetToken(User user)
    {
        byte[] tokenBytes = RandomNumberGenerator.GetBytes(32);
        string token = Convert.ToBase64String(tokenBytes);

        user.ResetToken = token;
        user.ResetTokenExpiration = DateTime.UtcNow.Add(ResetTokenLifetime);

        return token;
    }

    // ✅ Check if the token is valid for this user
    public bool ValidateResetToken(User user, string token)
    {
        if (user.ResetToken == null || user.ResetTokenExpiration == null)
            return false;

        if (user.ResetTokenExpiration < DateTime.UtcNow)
            return false;

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(user.ResetToken),
            Encoding.UTF8.GetBytes(token)
        );
    }

    // ✅ Clear reset token after use
    public void ClearResetToken(User user)
    {
        user.ResetToken = null;
        user.ResetTokenExpiration = null;
    }
}
