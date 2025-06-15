using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using FileBlogSystem.Models; // Assuming User model is in this namespace

namespace FileBlogSystem.Services;

public class JwtService
{
    private readonly string _secretKey;
    private readonly string _issuer;
    private readonly string _audience;
    private readonly int _expirationInMinutes;

public JwtService(IConfiguration configuration)
    {
        // Read values from appsettings.json
        _secretKey = configuration["JwtSettings:SecretKey"] ?? "your-super-secret-key-at-least-16-characters-long";
        _issuer = configuration["JwtSettings:Issuer"] ?? "FileBlogSystem";
        _audience = configuration["JwtSettings:Audience"] ?? "FileBlogSystemUsers";
        
        if (int.TryParse(configuration["JwtSettings:ExpirationInMinutes"], out int expirationMinutes))
        {
            _expirationInMinutes = expirationMinutes;
        }
        else
        {
            _expirationInMinutes = 60; // Default to 60 minutes if parsing fails
        }
    }
    public string GenerateToken(User user)
    {
        // Create claims based on user information
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role)
        };

        // Create signing credentials using the secret key
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        // Create the token
        var token = new JwtSecurityToken(
            issuer: _issuer,
            audience: _audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(_expirationInMinutes),
            signingCredentials: creds
        );

        // Return the serialized token
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    // Helper method to get token validation parameters for authentication configuration
    public TokenValidationParameters GetTokenValidationParameters()
    {
        return new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = _issuer,
            ValidAudience = _audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secretKey)),
            ClockSkew = TimeSpan.Zero // Disable clock skew for immediate expiration
        };
    }
}