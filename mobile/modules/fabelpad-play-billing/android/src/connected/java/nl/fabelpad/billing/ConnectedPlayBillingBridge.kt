package nl.fabelpad.billing

import android.app.Activity
import android.content.Context
import android.os.Handler
import android.os.Looper
import com.android.billingclient.api.*
import expo.modules.kotlin.Promise

/** Play only. Every returned purchase still needs backend owner verification. */
class ConnectedPlayBillingBridge(
  context: Context,
  private val activity: () -> Activity?,
  private val onPurchases: (List<Map<String, Any?>>) -> Unit
) : PlayBillingBridge {
  private val main = Handler(Looper.getMainLooper())
  private var purchasePromise: Promise? = null
  private var destroyed = false
  private val details = mutableMapOf<String, ProductDetails>()
  private var queriedAt = 0L
  private val client = BillingClient.newBuilder(context)
    .setListener { result, purchases ->
      main.post {
        val promise = purchasePromise
        purchasePromise = null
        if (result.responseCode == BillingClient.BillingResponseCode.OK) {
          val mapped = purchases.orEmpty().map(::purchaseMap)
          onPurchases(mapped)
          promise?.resolve(mapped)
        } else if (result.responseCode == BillingClient.BillingResponseCode.USER_CANCELED) promise?.resolve(emptyList<Any>())
        else promise?.reject("ERR_PLAY_PURCHASE", "Google Play kon de aankoop niet afronden. Herstel aankopen om de status te controleren.", null)
      }
    }
    .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
    .enableAutoServiceReconnection()
    .build()

  private fun purchaseMap(value: Purchase): Map<String, Any?> = mapOf(
    "purchaseToken" to value.purchaseToken, "productIds" to value.products,
    "state" to if (value.purchaseState == Purchase.PurchaseState.PURCHASED) "purchased" else "pending",
    "acknowledged" to value.isAcknowledged
  )
  private fun connected(promise: Promise, action: () -> Unit) {
    main.post {
      if (destroyed) { promise.reject("ERR_PLAY_CLOSED", "Open het ouderhoekje opnieuw.", null); return@post }
      if (client.isReady) action()
      else client.startConnection(object : BillingClientStateListener {
        override fun onBillingServiceDisconnected() = Unit
        override fun onBillingSetupFinished(result: BillingResult) {
          main.post {
            if (!destroyed && result.responseCode == BillingClient.BillingResponseCode.OK) action()
            else promise.reject("ERR_PLAY_UNAVAILABLE", "Google Play-betaling is tijdelijk niet beschikbaar.", null)
          }
        }
      })
    }
  }
  override fun products(productIds: List<String>, promise: Promise) {
    if (productIds.isEmpty() || productIds.size > 4 || productIds.any { !Regex("[a-zA-Z0-9._-]{1,200}").matches(it) }) {
      promise.reject("ERR_PLAY_PRODUCTS", "De abonnementen zijn nog niet ingesteld.", null); return
    }
    connected(promise) {
      val params = QueryProductDetailsParams.newBuilder().setProductList(productIds.distinct().map {
        QueryProductDetailsParams.Product.newBuilder().setProductId(it).setProductType(BillingClient.ProductType.SUBS).build()
      }).build()
      client.queryProductDetailsAsync(params) { result, response ->
        main.post {
          if (result.responseCode != BillingClient.BillingResponseCode.OK) {
            promise.reject("ERR_PLAY_PRODUCTS", "De actuele Google Play-prijzen konden niet worden opgehaald.", null)
          } else {
            details.clear()
            response.productDetailsList.forEach { details[it.productId] = it }
            queriedAt = System.currentTimeMillis()
            val offers = response.productDetailsList.flatMap { product ->
              product.subscriptionOfferDetails.orEmpty().filter { it.offerId == null }.mapNotNull { offer ->
                val phase = offer.pricingPhases.pricingPhaseList.singleOrNull()
                if (phase == null || phase.priceCurrencyCode != "EUR" || phase.recurrenceMode != ProductDetails.RecurrenceMode.INFINITE_RECURRING) null
                else mapOf("productId" to product.productId, "basePlanId" to offer.basePlanId, "offerToken" to offer.offerToken,
                  "formattedPrice" to phase.formattedPrice, "currency" to phase.priceCurrencyCode,
                  "priceAmountMicros" to phase.priceAmountMicros.toString(), "billingPeriod" to phase.billingPeriod)
              }
            }
            promise.resolve(offers)
          }
        }
      }
    }
  }
  override fun purchase(productId: String, basePlanId: String, accountId: String, offerToken: String, promise: Promise) {
    if (!Regex("[a-f0-9]{64}").matches(accountId)) { promise.reject("ERR_PLAY_BINDING", "Log opnieuw in als ouder.", null); return }
    connected(promise) {
      val product = details[productId]
      val offer = product?.subscriptionOfferDetails?.find { it.basePlanId == basePlanId && it.offerId == null && it.offerToken == offerToken }
      val current = activity()
      if (product == null || offer == null || current == null || current.isFinishing || System.currentTimeMillis() - queriedAt > 5 * 60_000) {
        promise.reject("ERR_PLAY_PRICE_CHANGED", "Laad de actuele prijs opnieuw voordat je koopt.", null)
      } else if (purchasePromise != null) promise.reject("ERR_PLAY_BUSY", "Er staat al een aankoop open.", null)
      else {
        purchasePromise = promise
        val params = BillingFlowParams.newBuilder().setObfuscatedAccountId(accountId).setProductDetailsParamsList(listOf(
          BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(product).setOfferToken(offer.offerToken).build()
        )).build()
        val result = client.launchBillingFlow(current, params)
        if (result.responseCode != BillingClient.BillingResponseCode.OK) {
          purchasePromise = null
          promise.reject("ERR_PLAY_PURCHASE", "Google Play kon de aankoop niet openen.", null)
        }
      }
    }
  }
  override fun restore(promise: Promise) {
    connected(promise) {
      client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build()) { result, purchases ->
        if (result.responseCode == BillingClient.BillingResponseCode.OK) promise.resolve(purchases.map(::purchaseMap))
        else promise.reject("ERR_PLAY_RESTORE", "Aankopen herstellen lukt nu niet. Probeer het later opnieuw.", null)
      }
    }
  }
  override fun destroy() {
    main.post { destroyed = true; purchasePromise?.reject("ERR_PLAY_CLOSED", "Herstel aankopen om de status te controleren.", null); purchasePromise = null; details.clear(); client.endConnection() }
  }
}
