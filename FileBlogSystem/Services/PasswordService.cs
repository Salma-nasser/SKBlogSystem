using System.Security.Cryptography;

namespace FileBlogSystem.Services;

public class PasswordService
{
  private const int SaltSize = 16;
  private const int HashSize = 32;
  private const int Iterations = 10000;

  // Generate a hashed password with a random salt
  public string HashPassword(string password)
  {
    // Generate a random salt
    byte[] salt = RandomNumberGenerator.GetBytes(SaltSize);

    // Hash the password with the salt
    byte[] hash = ComputeHash(password, salt);

    // Combine salt and hash for storage
    byte[] combinedHash = new byte[SaltSize + HashSize];
    Buffer.BlockCopy(salt, 0, combinedHash, 0, SaltSize);
    Buffer.BlockCopy(hash, 0, combinedHash, SaltSize, HashSize);

    return Convert.ToBase64String(combinedHash);
  }

  // Verify a password against a stored hash
  public bool VerifyPassword(string password, string storedHash)
  {
    byte[] combinedHash = Convert.FromBase64String(storedHash);

    // Extract salt and original hash
    byte[] salt = new byte[SaltSize];
    byte[] originalHash = new byte[HashSize];
    Buffer.BlockCopy(combinedHash, 0, salt, 0, SaltSize);
    Buffer.BlockCopy(combinedHash, SaltSize, originalHash, 0, HashSize);

    // Compute hash with extracted salt
    byte[] newHash = ComputeHash(password, salt);

    // Use constant-time comparison
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
}