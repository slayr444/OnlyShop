using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Caching.Memory;
using OnlyShop.Adapters.Common;
using OnlyShop.Application.Abstractions.Services;
using OnlyShop.Application.Dtos;
using System.Security.Claims;

namespace OnlyShop.Adapters.Endpoints;

internal static class MiniAppEndpoints
{
    public static void Map(IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api").RequireAuthorization(Policies.Customer);

        api.MapGet("/me", (ClaimsPrincipal user, IUserService users, CancellationToken ct) =>
            users.GetAsync(user.GetId(), ct));

        api.MapPut("/me", (ClaimsPrincipal user, UpdateProfileRequest request, IUserService users, CancellationToken ct) =>
            users.UpdateProfileAsync(user.GetId(), request, ct));

        var catalog = api.MapGroup("/catalog");

        catalog.MapGet("/categories", (ICatalogService service, CancellationToken ct) =>
            service.GetCategoriesAsync(ct));

        catalog.MapGet("/products", ([AsParameters] CatalogQuery query, ICatalogService service, CancellationToken ct) =>
            service.SearchAsync(query, ct));

        catalog.MapGet("/products/{id:guid}", (Guid id, ICatalogService service, CancellationToken ct) =>
            service.GetProductAsync(id, ct));

        app.MapGet("/api/settings", (IMemoryCache cache) =>
        {
            return new
            {
                brandName = cache.Get<string>("brand_name") ?? "ONLYSHOP",
                accentColor = cache.Get<string>("accent_color") ?? "#393CA7"
            };
        }).AllowAnonymous();

        var basket = api.MapGroup("/basket");

        basket.MapGet("/", (ClaimsPrincipal user, IBasketService service, CancellationToken ct) =>
            service.GetAsync(user.GetId(), ct));

        basket.MapPost("/items", (ClaimsPrincipal user, AddToBasketRequest request, IBasketService service, CancellationToken ct) =>
            service.AddItemAsync(user.GetId(), request, ct));

        basket.MapPut("/items/{variantId:guid}", (ClaimsPrincipal user, Guid variantId, QuantityRequest request, IBasketService service, CancellationToken ct) =>
            service.SetQuantityAsync(user.GetId(), variantId, request.Quantity, ct));

        basket.MapDelete("/items/{variantId:guid}", (ClaimsPrincipal user, Guid variantId, IBasketService service, CancellationToken ct) =>
            service.RemoveItemAsync(user.GetId(), variantId, ct));

        basket.MapDelete("/", (ClaimsPrincipal user, IBasketService service, CancellationToken ct) =>
            service.ClearAsync(user.GetId(), ct));

        var orders = api.MapGroup("/orders");

        orders.MapPost("/", (ClaimsPrincipal user, CheckoutRequest request, IOrderService service) =>
            service.CheckoutAsync(user.GetId(), request, CancellationToken.None));

        orders.MapGet("/", (ClaimsPrincipal user, IOrderService service, CancellationToken ct, int page = 1, int pageSize = 20) =>
            service.GetMyOrdersAsync(user.GetId(), page, pageSize, ct));

        orders.MapGet("/{id:guid}", (ClaimsPrincipal user, Guid id, IOrderService service, CancellationToken ct) =>
            service.GetMyOrderAsync(user.GetId(), id, ct));

        orders.MapPost("/{id:guid}/cancel", (ClaimsPrincipal user, Guid id, IOrderService service) =>
            service.CancelMyOrderAsync(user.GetId(), id, CancellationToken.None));
    }
}