using FileBlogSystem.Interfaces;

public class ScheduledPostPublisher : BackgroundService
{
  private readonly IServiceScopeFactory _scopeFactory;
  private readonly ILogger<ScheduledPostPublisher> _logger;
  private readonly TimeSpan _checkInterval = TimeSpan.FromMinutes(0.5); // Check every 30 seconds

  public ScheduledPostPublisher(IServiceScopeFactory scopeFactory, ILogger<ScheduledPostPublisher> logger)
  {
    _scopeFactory = scopeFactory;
    _logger = logger;
  }

  protected override async Task ExecuteAsync(CancellationToken stoppingToken)
  {
    while (!stoppingToken.IsCancellationRequested)
    {
      try
      {
        using var scope = _scopeFactory.CreateScope();
        var blogService = scope.ServiceProvider.GetRequiredService<IBlogPostService>();

        var now = DateTime.UtcNow;
        var scheduledPosts = blogService.GetAllPostsIncludingDrafts()
                                        .Where(p => !p.IsPublished && p.ScheduledDate.HasValue && p.ScheduledDate <= now)
                                        .ToList();

        foreach (var post in scheduledPosts)
        {
          var (success, message) = await blogService.PublishPostAsync(post.Slug, post.Author);
          if (success)
            _logger.LogInformation($"✅ Scheduled post '{post.Title}' published automatically at {now}.");
          else
            _logger.LogWarning($"⚠️ Failed to publish scheduled post '{post.Title}': {message}");
        }
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Error while checking scheduled posts.");
      }

      await Task.Delay(_checkInterval, stoppingToken);
    }
  }
}
