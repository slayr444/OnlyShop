using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using OnlyShop.Adapters.Common;
using OnlyShop.Adapters.Options;
using OnlyShop.Adapters.Telegram;
using OnlyShop.Application.Abstractions.Services;
using OnlyShop.Application.Common.Models;
using OnlyShop.Application.Dtos;
using OnlyShop.Core.Common;
using System.Security.Claims;


namespace OnlyShop.Adapters.Endpoints;

internal static class AdminEndpoints
{
    private const long MaxFileBytes = 10 * 1024 * 1024;
    private static readonly string[] AllowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

    public static void Map(IEndpointRouteBuilder app)
    {
        var admin = app.MapGroup("/api/admin").RequireAuthorization(Policies.Staff);

        admin.MapPost("/me/telegram-link", (ClaimsPrincipal user, StaffLinkCodes codes, IOptions<TelegramWebhookOptions> options) =>
        {
            var code = codes.Create(user.GetId());
            return new { code, url = $"https://t.me/{options.Value.BotUsername}?start=link_{code}" };
        });

        var products = admin.MapGroup("/products");

        products.MapGet("/", ([AsParameters] AdminProductQuery query, IProductManagementService service, CancellationToken ct) =>
            service.SearchAsync(query, ct));

        products.MapGet("/{id:guid}", (Guid id, IProductManagementService service, CancellationToken ct) =>
            service.GetAsync(id, ct));

        products.MapPost("/", async (ClaimsPrincipal user, CreateProductRequest request, IProductManagementService service, CancellationToken ct) =>
        {
            var product = await service.CreateAsync(user.GetId(), request, ct);
            return Results.Created($"/api/admin/products/{product.Id}", product);
        });

        var settings = admin.MapGroup("/settings");
        settings.MapGet("/", (IMemoryCache cache) =>
        {
            return new
            {
                BrandName = cache.Get<string>("brand_name") ?? "ONLYSHOP",
                AccentColor = cache.Get<string>("accent_color") ?? "#393CA7"
            };
        });

        settings.MapPut("/", (UpdateSettingsReq req, IMemoryCache cache) =>
        {
            cache.Set("brand_name", req.BrandName);
            cache.Set("accent_color", req.AccentColor);
            return Results.NoContent();
        });

        products.MapPut("/{id:guid}", (ClaimsPrincipal user, Guid id, UpdateProductRequest request, IProductManagementService service, CancellationToken ct) =>
            service.UpdateDetailsAsync(user.GetId(), id, request, ct));

        products.MapPut("/{id:guid}/price", (ClaimsPrincipal user, Guid id, ChangePriceRequest request, IProductManagementService service, CancellationToken ct) =>
            service.ChangePriceAsync(user.GetId(), id, request, ct));

        products.MapPut("/{id:guid}/presale", (ClaimsPrincipal user, Guid id, SetPresaleRequest request, IProductManagementService service, CancellationToken ct) =>
            service.SetPresaleAsync(user.GetId(), id, request, ct));

        products.MapPut("/{id:guid}/in-stock", (ClaimsPrincipal user, Guid id, IProductManagementService service, CancellationToken ct) =>
            service.SetInStockAsync(user.GetId(), id, ct));



        products.MapPost("/{id:guid}/variants", (ClaimsPrincipal user, Guid id, VariantInput request, IProductManagementService service, CancellationToken ct) =>
            service.AddVariantAsync(user.GetId(), id, request, ct));

        products.MapPatch("/{id:guid}/variants/{variantId:guid}/stock", (ClaimsPrincipal user, Guid id, Guid variantId, StockDeltaRequest request, IProductManagementService service, CancellationToken ct) =>
            service.AdjustStockAsync(user.GetId(), id, variantId, request.Delta, ct));

        products.MapPost("/{id:guid}/photos", (ClaimsPrincipal user, Guid id, IFormFile file, IProductManagementService service, CancellationToken ct) =>
            service.AddPhotoAsync(user.GetId(), id, ToUpload(file), ct)).DisableAntiforgery();

        products.MapPost("/{id:guid}/publish", (ClaimsPrincipal user, Guid id, IProductManagementService service, CancellationToken ct) =>
            service.PublishAsync(user.GetId(), id, ct));

        products.MapPost("/{id:guid}/archive", (ClaimsPrincipal user, Guid id, IProductManagementService service, CancellationToken ct) =>
            service.ArchiveAsync(user.GetId(), id, ct));

        var categories = admin.MapGroup("/categories");

        categories.MapGet("/", (ICatalogService service, CancellationToken ct) =>
            service.GetCategoriesAsync(ct));

        categories.MapPost("/", (CategoryRequest request, ICategoryManagementService service, CancellationToken ct) =>
            service.CreateAsync(request, ct));

        categories.MapPut("/{id:guid}", (Guid id, CategoryRequest request, ICategoryManagementService service, CancellationToken ct) =>
            service.UpdateAsync(id, request, ct));

        categories.MapDelete("/{id:guid}", async (Guid id, ICategoryManagementService service, CancellationToken ct) =>
        {
            await service.DeleteAsync(id, ct);
            return Results.NoContent();
        });

        var locations = admin.MapGroup("/presale-locations");

        locations.MapGet("/", (IPresaleLocationService service, CancellationToken ct) =>
            service.GetAllAsync(ct));

        locations.MapPost("/", ([FromForm] string name, [FromForm] string? description, IFormFile? photo, IPresaleLocationService service, CancellationToken ct) =>
            service.CreateAsync(new PresaleLocationRequest(name, description), photo is null ? null : ToUpload(photo), ct)).DisableAntiforgery();

        locations.MapPut("/{id:guid}", (Guid id, [FromForm] string name, [FromForm] string? description, IFormFile? photo, IPresaleLocationService service, CancellationToken ct) =>
            service.UpdateAsync(id, new PresaleLocationRequest(name, description), photo is null ? null : ToUpload(photo), ct)).DisableAntiforgery();

        locations.MapDelete("/{id:guid}", async (Guid id, IPresaleLocationService service, CancellationToken ct) =>
        {
            await service.DeleteAsync(id, ct);
            return Results.NoContent();
        });

        var orders = admin.MapGroup("/orders");

        orders.MapGet("/", ([AsParameters] AdminOrderQuery query, IOrderManagementService service, CancellationToken ct) =>
            service.SearchAsync(query, ct));

        orders.MapGet("/{id:guid}", (Guid id, IOrderManagementService service, CancellationToken ct) =>
            service.GetAsync(id, ct));

        orders.MapPost("/{id:guid}/status", (ClaimsPrincipal user, Guid id, ChangeOrderStatusRequest request, IOrderManagementService service) =>
            service.ChangeStatusAsync(user.GetId(), id, request, CancellationToken.None));

        var staff = admin.MapGroup("/staff").RequireAuthorization(Policies.AdminOnly);

        staff.MapGet("/", (IStaffService service, CancellationToken ct) =>
            service.GetAllAsync(ct));

        staff.MapPost("/", (CreateStaffRequest request, IStaffService service, CancellationToken ct) =>
            service.CreateAsync(request, ct));

        staff.MapPut("/{id:guid}/telegram", async (Guid id, UpdateStaffTelegramRequest request, IStaffService service, CancellationToken ct) =>
        {
            await service.UpdateTelegramIdAsync(id, request.TelegramId, ct);
            return Results.NoContent();
        });

        staff.MapPut("/{id:guid}/active", async (Guid id, SetActiveRequest request, IStaffService service, CancellationToken ct) =>
        {
            await service.SetActiveAsync(id, request.IsActive, ct);
            return Results.NoContent();
        });
    }

    private static FileUpload ToUpload(IFormFile file)
    {
        if (file.Length is 0 or > MaxFileBytes)
        {
            throw new DomainException("File is empty or too large");
        }

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();

        if (!AllowedExtensions.Contains(extension))
        {
            throw new DomainException("Allowed formats: jpg, png, webp, gif");
        }

        return new FileUpload(file.OpenReadStream(), file.FileName, file.ContentType);
    }
}

internal record UpdateSettingsReq(string BrandName, string AccentColor);
