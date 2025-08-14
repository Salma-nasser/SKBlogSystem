# ===== BUILD STAGE =====
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy csproj and restore dependencies
COPY FileBlogSystem.csproj .
RUN dotnet restore FileBlogSystem.csproj

# Copy everything else and build
COPY . .
RUN dotnet publish FileBlogSystem.csproj -c Release -o /app/publish --no-restore

# ===== RUNTIME STAGE =====
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Copy published app
COPY --from=build /app/publish .

# Ensure content folders exist
RUN mkdir -p /app/Content/posts /app/Content/users

# Expose port
EXPOSE 80
ENV ASPNETCORE_URLS=http://+:80

# Declare volumes
VOLUME ["/app/Content/posts", "/app/Content/users"]

# Start the app
ENTRYPOINT ["dotnet", "FileBlogSystem.dll"]
