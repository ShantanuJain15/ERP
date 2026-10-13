# pyrefly: ignore [missing-import]
from django.urls import include, path
from rest_framework.authtoken.views import obtain_auth_token
from rest_framework.routers import DefaultRouter

from .views import (
    BillViewSet,
    BrandOfferDiscoveryView,
    CustomerViewSet,
    GoodsReceiptViewSet,
    HSNCodeViewSet,
    InvoiceItemViewSet,
    InvoiceViewSet,
    OfferDiscoveryView,
    PaymentOutViewSet,
    ProductViewSet,
    PurchaseOrderViewSet,
    StockMovementViewSet,
    SupplierViewSet,
    WarehouseViewSet,
    WarehouseStockViewSet,
)

app_name = "inventory"

router = DefaultRouter()
router.register("products", ProductViewSet, basename="product")
router.register("suppliers", SupplierViewSet, basename="supplier")
router.register("customers", CustomerViewSet, basename="customer")
router.register("invoices", InvoiceViewSet, basename="invoice")
router.register("invoicesitem", InvoiceItemViewSet, basename="invoiceitem")
router.register("warehouses", WarehouseViewSet, basename="warehouse")
router.register("warehouse-stock", WarehouseStockViewSet, basename="warehousestock")
router.register("stock-movements", StockMovementViewSet, basename="stockmovement")

# ── Procure to pay ───────────────────────────────────────────────────────────
router.register("hsn-codes", HSNCodeViewSet, basename="hsncode")
router.register("purchase-orders", PurchaseOrderViewSet, basename="purchaseorder")
router.register("purchase-receives", GoodsReceiptViewSet, basename="goodsreceipt")
router.register("bills", BillViewSet, basename="bill")
router.register("payments-out", PaymentOutViewSet, basename="paymentout")
# router.register("acs", ACViewSet, basename="ac")

urlpatterns = [
    path("token/", obtain_auth_token, name="token_auth"), # this is obselete as I have remove TokenAuthentication from the default authentication classes in settings.py, and I am using JWTAuthentication instead,
    path("offers/discover/", OfferDiscoveryView.as_view(), name="offer-discover"),
    path("offers/discover-brand/", BrandOfferDiscoveryView.as_view(), name="offer-discover-brand"),
    path("", include(router.urls)),
]
