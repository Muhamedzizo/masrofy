package expo.modules.masrofy.notifications

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class NotificationParserTest {
  @Test
  fun parsesVodafoneCashSmsTransferAmountAndIgnoresServiceFee() {
    val message = "تم تحويل 5 جنيه لرقم 0100000000 مصاريف الخدمة 1 جنيه " +
      "رصيد حسابك في فودافون كاش الحالي 12.74 تاريخ العملية 18-11-26 21:18 " +
      "رقم العملية 0000000000"

    val parsed = NotificationParser.parseOutgoingSuccessfulTransaction(message)

    assertEquals(500, parsed?.amountPiasters ?: -1)
  }

  @Test
  fun rejectsIncomingVodafoneCashTransferSms() {
    val message = "تم تحويل إليك 5 جنيه بنجاح"

    assertNull(NotificationParser.parseOutgoingSuccessfulTransaction(message))
  }

  @Test
  fun parsesArabicInstantCardTransferAmount() {
    val message = "تم تنفيذ تحويل لحظي من بطاقتكم مسبقة الدفع بمبلغ 4220.00 جم " +
      "إلى مستفيد تجريبي رقم مرجعي 000000000000 يوم 11-16 الساعة 23:18"

    val parsed = NotificationParser.parseOutgoingSuccessfulTransaction(message)

    assertEquals(422000, parsed?.amountPiasters ?: -1)
  }

  @Test
  fun parsesCardDebitAmountAndIgnoresAvailableBalance() {
    val message = "تم خصم 2199 EGP من بطاقة مسبقة الدفع رقم 0000 " +
      "عند متجر تجريبي يوم 27/10/26 الساعة 18:51 المتاح 1.37EGP"

    val parsed = NotificationParser.parseOutgoingSuccessfulTransaction(message)

    assertEquals(219900, parsed?.amountPiasters ?: -1)
  }

  @Test
  fun parsesIpnTransferSentAmount() {
    val message = "IPN transfer sent with amount of EGP 140.00 from 0000 " +
      "on 08/11 at 11:02 PM. Ref# test-reference. For details call 00000."

    val parsed = NotificationParser.parseOutgoingSuccessfulTransaction(message)

    assertEquals(14000, parsed?.amountPiasters ?: -1)
  }

  @Test
  fun rejectsIncomingInstantCardTransferSms() {
    val message = "تم إضافة تحويل لحظي لبطاقتكم مسبقة الدفع بمبلغ 1000.00 جم " +
      "من مرسل تجريبي على رقم مرجعي 000000000000 يوم 10-19 الساعة 23:15"

    assertNull(NotificationParser.parseOutgoingSuccessfulTransaction(message))
  }
}
