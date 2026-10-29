using System.Globalization;
using System.Net;
using System.Text;
using OnlyShop.Application.Abstractions.Infrastructure;
using OnlyShop.Application.Dtos;
using OnlyShop.Core.Enums;
using Telegram.Bot;
using Telegram.Bot.Types.Enums;
using Telegram.Bot.Types.ReplyMarkups;

namespace OnlyShop.Infrastructure.Telegram;

public class TelegramOrderNotifier(ITelegramBotClient bot) : IOrderNotifier
{
    public async Task NotifyManagersAboutNewOrderAsync(
        OrderDto order, UserDto customer, IReadOnlyList<long> managerTelegramIds, CancellationToken ct = default)
    {
        var text = BuildOrderMessage(order, customer);

        var keyboard = BuildKeyboard(order.Id);

        foreach (var managerId in managerTelegramIds)
        {
            try
            {
                await bot.SendMessage(
                    chatId: managerId,
                    text: text,
                    parseMode: ParseMode.Html,
                    replyMarkup: keyboard,
                    cancellationToken: ct);
            }
            catch
            {
            }
        }
    }

    public Task NotifyCustomerAboutStatusAsync(long customerTelegramId, OrderDto order, CancellationToken ct = default) =>
        bot.SendMessage(customerTelegramId, $"Статус вашего заказа №{order.Id.ToString().Substring(0, 8).ToUpper()} изменён: {GetStatusText(order.Status)}", cancellationToken: ct);

    private static InlineKeyboardMarkup BuildKeyboard(Guid orderId)
    {
        var id = orderId.ToString("N");

        return new InlineKeyboardMarkup(new[]
        {
            new[]
            {
                InlineKeyboardButton.WithCallbackData("✅ Принять", $"order:{id}:{(int)OrderStatus.Confirmed}"),
                InlineKeyboardButton.WithCallbackData("💳 Оплачен", $"order:{id}:{(int)OrderStatus.Paid}")
            },
            new[]
            {
                InlineKeyboardButton.WithCallbackData("🚚 В пути", $"order:{id}:{(int)OrderStatus.Delivering}"),
                InlineKeyboardButton.WithCallbackData("🏁 Завершён", $"order:{id}:{(int)OrderStatus.Completed}")
            },
            new[]
            {
                InlineKeyboardButton.WithCallbackData("❌ Отменить", $"order:{id}:{(int)OrderStatus.Canceled}")
            }
        });
    }

    private static string BuildOrderMessage(OrderDto order, UserDto customer)
    {
        var sb = new StringBuilder();
        var shortId = order.Id.ToString().Substring(0, 8).ToUpper();

        sb.AppendLine($"🆕 <b>Новый заказ #{shortId}</b>");
        sb.AppendLine();

        var contact = !string.IsNullOrWhiteSpace(customer.Username) ? $"@{customer.Username}" : "без username";
        sb.AppendLine($"<b>Клиент:</b> {WebUtility.HtmlEncode(order.CustomerName)} ({contact})");
        sb.AppendLine($"<b>Телефон:</b> {WebUtility.HtmlEncode(order.CustomerPhone ?? "—")}");

        if (customer.TelegramId > 0)
        {
            sb.AppendLine($"<b>User ID:</b> {customer.TelegramId}");
        }
        sb.AppendLine();

        sb.AppendLine("📦 <b>Состав заказа:</b>");
        foreach (var item in order.Items)
        {
            sb.AppendLine($"• {WebUtility.HtmlEncode(item.ProductName)}");
            sb.AppendLine($"  Размер: {item.Size} | {item.Quantity} шт. × {item.UnitPrice} = <b>{item.Total} {GetCurrencyText(order.Currency)}</b>");
        }
        sb.AppendLine();

        if (order.BonusesSpent > 0)
        {
            sb.AppendLine($"🎁 <b>Списано бонусов:</b> {order.BonusesSpent} {GetCurrencyText(order.Currency)}");
        }
        sb.AppendLine($"💳 <b>Итого к оплате:</b> {order.Total} {GetCurrencyText(order.Currency)}");
        sb.AppendLine();

        sb.AppendLine("🚚 <b>Данные для доставки:</b>");
        sb.AppendLine($"<b>Способ:</b> {GetDeliveryText(order.DeliveryMethod)}");
        if (!string.IsNullOrWhiteSpace(order.DeliveryAddress))
        {
            sb.AppendLine($"<b>Адрес:</b> {WebUtility.HtmlEncode(order.DeliveryAddress)}");
        }
        sb.AppendLine($"<b>Оплата:</b> {GetPaymentText(order.PaymentMethod)}");

        if (!string.IsNullOrWhiteSpace(order.Comment))
        {
            sb.AppendLine($"<b>Пожелания:</b> {WebUtility.HtmlEncode(order.Comment)}");
        }

        sb.AppendLine();
        sb.AppendLine($"<b>Статус:</b> {GetStatusText(order.Status)}");

        var moscowTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Russian Standard Time");
        var localTime = TimeZoneInfo.ConvertTimeFromUtc(order.CreatedAt, moscowTimeZone);

        sb.AppendLine($"<i>{localTime:dd.MM.yyyy HH:mm}</i>");

        return sb.ToString();
    }

    private static string GetCurrencyText(Currency currency) => currency switch
    {
        Currency.Byn => "BYN",
        Currency.Rub => "RUB",
        _ => currency.ToString()
    };

    private static string GetDeliveryText(DeliveryMethod method) => method switch
    {
        DeliveryMethod.Courier => "Курьер",
        DeliveryMethod.Pickup => "Самовывоз",
        _ => method.ToString()
    };

    private static string GetPaymentText(PaymentMethod method) => method switch
    {
        PaymentMethod.Cash => "Наличными",
        PaymentMethod.CardTransfer => "Переводом на карту",
        PaymentMethod.Online => "Онлайн-оплата",
        _ => method.ToString()
    };

    private static string GetStatusText(OrderStatus status) => status switch
    {
        OrderStatus.Pending => "В обработке ⏳",
        OrderStatus.Confirmed => "Принят ✅",
        OrderStatus.Paid => "Оплачен 💰",
        OrderStatus.Delivering => "Отправлен 🚚",
        OrderStatus.Completed => "Завершен 🎉",
        OrderStatus.Canceled => "Отменен ❌",
        _ => status.ToString()
    };
}