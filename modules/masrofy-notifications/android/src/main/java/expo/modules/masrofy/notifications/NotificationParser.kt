package expo.modules.masrofy.notifications

import java.math.BigDecimal
import java.math.RoundingMode
import java.util.Locale

internal data class ParsedNotification(
  val amountPiasters: Int,
  val description: String?
)

internal object NotificationParser {
  private const val MAX_PAYEE_LENGTH = 48

  private val amountPattern = Regex(
    "(?<![\\p{L}\\d])((?:\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|" +
      "\\d{1,3}(?:\\.\\d{3})+(?:,\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?))(?!\\d)"
  )
  private val currencyPattern = Regex("(?i)(?:\\bEGP\\b|\\bL\\.?E\\.?\\b|جنيه(?:\\s+مصري)?|ج\\s*\\.?\\s*م\\s*\\.?)")
  private val englishOutgoingPattern = Regex(
    "(?i)\\b(?:sent|send|transferred|transfer|paid|payment|debited|debit|purchase|withdrawn|withdrawal|outgoing)\\b"
  )
  private val englishSuccessPattern = Regex(
    "(?i)\\b(?:success|successful|succeeded|completed|complete|approved|processed)\\b"
  )
  private val englishFailurePattern = Regex(
    "(?i)\\b(?:fail(?:ed|ure)?|declined|rejected|pending|processing|cancelled|canceled|unsuccessful|reversed|refunded)\\b"
  )
  private val englishInboundPattern = Regex(
    "(?i)\\b(?:received|receiving|incoming|deposit(?:ed)?|credited|cash\\s*-?\\s*in|top\\s*-?\\s*up)\\b"
  )
  private val arabicFailureTerms = listOf(
    "فشل", "فاشل", "مرفوض", "رفض", "معلقة", "معلق", "قيد المعالجة", "لم تتم", "ألغيت", "الغيت", "ملغاة", "مسترد"
  )
  private val arabicInboundTerms = listOf(
    "استلام", "استلم", "استقبل", "وارد", "إيداع", "ايداع", "تم إيداع", "تم ايداع",
    "إضافة رصيد", "اضافة رصيد", "أضيف إلى", "وصل إليك", "وصل اليك", "تم تحويل إليك", "تم تحويل اليك"
  )
  private val arabicOutgoingTerms = listOf(
    "تحويل", "إرسال", "ارسال", "خصم", "دفعت", "دفع", "سداد", "شراء", "صادر", "سحب"
  )
  private val arabicSuccessTerms = listOf(
    "بنجاح", "ناجح", "ناجحة", "اكتمل", "اكتملت", "تم تنفيذ", "تمت العملية",
    "تم التحويل", "تم الإرسال", "تم الارسال", "تم الخصم", "تم الدفع", "تم السداد", "تم الشراء"
  )

  private val labelledPayeePattern = Regex(
    "(?im)(?:\\b(?:merchant|payee|recipient|beneficiary|vendor)\\b|(?:اسم\\s+)?(?:التاجر|المستفيد|الجهة|المتلقي))\\s*[:：=\\-]\\s*([^\\n,;|]+)"
  )
  private val englishPayeePattern = Regex("(?i)\\b(?:to|at)\\s+([^\\n,;|.!?]+)")
  private val arabicPayeePattern = Regex("(?:إلى|الى|لدى)(?=\\s|[:：])\\s*[:：]?\\s*([^\\n,;|.!?]+)")
  private val leadingPayeeLabelPattern = Regex(
    "(?i)^(?:merchant|payee|recipient|beneficiary|vendor|(?:اسم\\s+)?(?:التاجر|المستفيد|الجهة|المتلقي))\\s*[:：=\\-]?\\s*"
  )
  private val trailingStatusPattern = Regex(
    "(?i)\\s+(?:success(?:ful)?|completed|approved|processed|بنجاح|ناجح(?:ة)?|تم\\s+بنجاح|تمت\\s+العملية)\\s*$"
  )
  private val nonPayeeWordPattern = Regex(
    "(?i)\\b(?:account|wallet|balance|transaction|reference|ref|available|card|amount|payment|transfer|status|success|completed|approved)\\b"
  )
  private val arabicNonPayeeTerms = listOf(
    "حساب", "محفظة", "رصيد", "رقم", "مرجع", "العملية", "المبلغ", "جنيه", "قيد المعالجة"
  )
  private val controlCharacters = Regex("[\\p{Cntrl}\\p{Cf}]")
  private val whitespace = Regex("\\s+")
  private val payeeCharacters = Regex("[\\p{L}\\p{M}\\s&'’.-]+")

  fun parseOutgoingSuccessfulTransaction(rawText: String): ParsedNotification? {
    if (rawText.isBlank()) return null
    val text = normalize(rawText)
    if (englishFailurePattern.containsMatchIn(text) || arabicFailureTerms.any(text::contains)) return null
    if (englishInboundPattern.containsMatchIn(text) || arabicInboundTerms.any(text::contains)) return null
    if (englishOutgoingPattern.containsMatchIn(text).not() && arabicOutgoingTerms.none(text::contains)) return null

    val hasSuccess = englishSuccessPattern.containsMatchIn(text) || arabicSuccessTerms.any(text::contains)
    if (!hasSuccess) return null

    val currencies = currencyPattern.findAll(text).toList()
    val amounts = amountPattern.findAll(text).mapNotNull { amount ->
      val currencyIsAdjacent = currencies.any { currency ->
        when {
          currency.range.last < amount.range.first -> {
            val gap = text.substring(currency.range.last + 1, amount.range.first)
            gap.length <= 12 && gap.none(Char::isLetterOrDigit)
          }
          amount.range.last < currency.range.first -> {
            val gap = text.substring(amount.range.last + 1, currency.range.first)
            gap.length <= 12 && gap.none(Char::isLetterOrDigit)
          }
          else -> false
        }
      }
      if (!currencyIsAdjacent) return@mapNotNull null
      parsePiasters(amount.groupValues[1])
    }.distinct()

    // Multiple currency-tagged amounts are ambiguous (for example, amount plus available balance).
    val amount = amounts.singleOrNull() ?: return null
    return ParsedNotification(amountPiasters = amount, description = parsePayee(rawText))
  }

  fun parseOutgoingSuccessfulAmount(rawText: String): Int? =
    parseOutgoingSuccessfulTransaction(rawText)?.amountPiasters

  private fun parsePayee(rawText: String): String? {
    val candidates = buildList {
      labelledPayeePattern.findAll(rawText).forEach { add(it.groupValues[1]) }
      englishPayeePattern.findAll(rawText).forEach { add(it.groupValues[1]) }
      arabicPayeePattern.findAll(rawText).forEach { add(it.groupValues[1]) }
    }
    return candidates
      .mapNotNull(::sanitizePayee)
      .distinctBy { it.lowercase(Locale.ROOT) }
      .singleOrNull()
  }

  private fun sanitizePayee(rawValue: String): String? {
    var value = rawValue
      .replace(controlCharacters, " ")
      .replace(whitespace, " ")
      .trim()
    value = leadingPayeeLabelPattern.replace(value, "")
    value = trailingStatusPattern.replace(value, "")
    value = value
      .trim { character -> character.isWhitespace() || character in ".,;:|–—-\"'()[]" }
      .replace(whitespace, " ")

    if (value.isBlank() || value.length > MAX_PAYEE_LENGTH) return null
    if (value.any(Char::isDigit) || !payeeCharacters.matches(value)) return null
    if (value.count(Char::isLetter) < 2 || nonPayeeWordPattern.containsMatchIn(value)) return null
    val normalized = value.lowercase(Locale.ROOT)
    if (arabicNonPayeeTerms.any(normalized::contains)) return null
    return value
  }

  private fun parsePiasters(value: String): Int? {
    val normalized = normalizeDigits(value)
    val lastComma = normalized.lastIndexOf(',')
    val lastDot = normalized.lastIndexOf('.')
    val decimalSeparator = when {
      lastComma >= 0 && lastDot >= 0 -> if (lastComma > lastDot) ',' else '.'
      lastComma >= 0 && normalized.length - lastComma - 1 != 3 -> ','
      lastDot >= 0 && normalized.length - lastDot - 1 != 3 -> '.'
      else -> null
    }
    val canonical = if (decimalSeparator == null) {
      normalized.filter(Char::isDigit)
    } else {
      val integerPart = normalized.substringBeforeLast(decimalSeparator).filter(Char::isDigit)
      val fractionalPart = normalized.substringAfterLast(decimalSeparator).filter(Char::isDigit)
      if (fractionalPart.length !in 1..2) return null
      "$integerPart.$fractionalPart"
    }

    return try {
      BigDecimal(canonical)
        .movePointRight(2)
        .setScale(0, RoundingMode.UNNECESSARY)
        .intValueExact()
        .takeIf { it > 0 }
    } catch (_: ArithmeticException) {
      null
    } catch (_: NumberFormatException) {
      null
    }
  }

  private fun normalize(raw: String): String = normalizeDigits(raw)
    .replace('\u066B', '.')
    .replace('\u066C', ',')
    .replace('\u0640', ' ')
    .replace(Regex("[\\u064B-\\u065F\\u0670]"), "")
    .lowercase(Locale.ROOT)

  private fun normalizeDigits(value: String): String = buildString(value.length) {
    value.forEach { character ->
      val digit = when (character) {
        in '\u0660'..'\u0669' -> character.code - '\u0660'.code
        in '\u06F0'..'\u06F9' -> character.code - '\u06F0'.code
        else -> -1
      }
      append(if (digit >= 0) ('0'.code + digit).toChar() else character)
    }
  }
}
