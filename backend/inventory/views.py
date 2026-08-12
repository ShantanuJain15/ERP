# from django.db.models import Q
from rest_framework import viewsets
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.pagination import LimitOffsetPagination
from .models import  Product,Customer,Invoice,InvoiceItem
from .serializers import ProductSerializer, CustomerSerializer,InvoiceSerializer,InvoiceItemSerializer
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication


from django.http import HttpResponse

from .services.invoice_pdf import generate_invoice_pdf
import io
from .services.invoice_email import send_invoice_email
from rest_framework.views import APIView
from rest_framework import status as drf_status
from .services.pinelabs import PineLabsClient, PineLabsAPIError

class IsAdminForCreateDelete(BasePermission):
    def has_permission(self, request, view):
        if request.method in {"POST", "DELETE"}: #  Patch and Delete is still allowed for the users
            return bool(request.user and request.user.is_staff)
        return True

class StandardResultsSetPagination(LimitOffsetPagination) :
    default_limit = 2
    max_limit = 4


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all().order_by("-created_at") # it is a lazy queryset, it will not hit the database until it is evaluated
    serializer_class = ProductSerializer
    # permission_classes = [IsAuthenticated, IsAdminForCreateDelete] # 
    # pagination_class = StandardResultsSetPagination
    # authentication_classes = [JWTAuthentication] # it is simplejwt

    def get_queryset(self):
        queryset = super().get_queryset()
        name = self.request.query_params.get("name")
        sku = self.request.query_params.get("sku")

        if name and sku:
            return queryset.filter(name__icontains=name, sku__iexact=sku)
        if name:
            return queryset.filter(name__icontains=name)
        if sku:
            return queryset.filter(sku__iexact=sku)

        return queryset
    
    @action(detail=False, methods=["get"], url_path="stats", permission_classes=[IsAdminUser]) # details is false since it is not related to a single product, it is related to the whole collection of products, so it is a collection action, and it will be accessed by /products/stats/ url, and it will be a get request since we are just getting the stats, and it will not be a post request since we are not creating anything, and it will not be a patch request since we are not updating anything, and it will not be a delete request since we are not deleting anything
    def stats(self, request):
        # type=request.query_params.get("type")
        total_products = self.get_queryset().count()
        total_active = self.get_queryset().filter(is_active=True).count()
        total_inactive = self.get_queryset().filter(is_active=False).count()

        return Response({
            "total_products": total_products,
            "total_active": total_active,
            "total_inactive": total_inactive
        })
     
    def perform_create(self, serializer): # perform_create is then called by the create()
        serializer.save(
        # last_modified_by=self.request.user,
        last_modified_by_username=self.request.user.username
        )

    def perform_update(self, serializer):
        serializer.save(
            # last_modified_by=self.request.user,
            last_modified_by_username=self.request.user.username
        )


# class ACViewSet(viewsets.ModelViewSet):
#     queryset = AC.objects.all().order_by("-created_at")
#     serializer_class = ACSerializer
#     permission_classes = [IsAuthenticated, IsAdminForCreateDelete]
#     authentication_classes = [JWTAuthentication]




class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all().order_by("-created_at") # what 
    serializer_class=CustomerSerializer
    
    def perform_create(self, serializer): # perform_create is then called by the create()
        # print("helloo"+self.request.user.username)
        serializer.save(
        # last_modified_by=self.request.user,
        last_modified_by_username=self.request.user.username
        )
    
    def perform_update(self, serializer):
        serializer.save(
            # last_modified_by=self.request.user,
            last_modified_by_username=self.request.user.username
        )
    


class InvoiceViewSet(viewsets.ModelViewSet) :
    queryset = Invoice.objects.all()#.order_by("-created_at")
    serializer_class=InvoiceSerializer

    def get_queryset(self):
        """Return only active (current) invoice versions by default."""
        qs = super().get_queryset()
        # Allow ?all_versions=true to see everything (admin debug)
        if self.request.query_params.get("all_versions") == "true":
            return qs
        return qs.filter(is_active=True)

    def perform_create(self, serializer): # perform_create is then called by the create()

        serializer.save(
        last_modified_by_username=self.request.user.username
        )

    @action(detail=True, methods=["get"], url_path="version-history")
    def version_history(self, request, pk=None):
        """Return all versions of the given invoice (by invoice_number)."""
        invoice = self.get_object()
        all_versions = (
            Invoice.objects
            .filter(invoice_number=invoice.invoice_number)
            .order_by("-version")
        )
        serializer = self.get_serializer(all_versions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="next-number")
    def next_number(self, request):
        """Return the next auto-generated invoice number."""
        try:
            number = InvoiceSerializer._next_invoice_number()
            return Response({"next_invoice_number": number})
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=["get"])
    def download_pdf(self, request, pk=None):
        invoice = self.get_object()

           

        buffer = io.BytesIO()
        generate_invoice_pdf(buffer, invoice)

        buffer.seek(0)

        return HttpResponse(
            buffer,
            content_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="invoice_{invoice.id}.pdf"'
            },
        )

    @action(methods=["post"], detail=True)
    def send_email_pdf(self, request, pk=None):
        invoice = self.get_object()
        recepient_email = request.data.get("email")
        recepient_email=recepient_email.strip()
        try:
            send_invoice_email(invoice, recepient_email)
            return Response("Email sent successfully", status=200)
        except ValueError as ve:
            return Response(str(ve), status=400)
        except Exception as e:
            return Response(str(e), status=500) 
    
    
        




    
class InvoiceItemViewSet(viewsets.ModelViewSet) :
    queryset = InvoiceItem.objects.all()#.order_by("-created_at")
    serializer_class=InvoiceItemSerializer

    # def perform_create(self, serializer): # perform_create is then called by the create()

    #     serializer.save(
    #     last_modified_by_username=self.request.user.username
    #     )


class OfferDiscoveryView(APIView):
    """
    POST /api/inventory/offers/discover/

    Proxies to Pine Labs Offer Discovery API and returns EMI / offer details.

    Expected JSON body:
    {
        "order_amount": 1200000,       // amount in smallest currency unit (paise)
        "currency": "INR",             // optional, defaults to INR
        "bin": "60100000",             // issuer BIN (first 6-8 digits)
        "card_number": "4000...",      // full or masked card number
        "customer_id": "cust-..."      // unique customer identifier
    }
    """

    def post(self, request):
        data = request.data

        # ── validate required field ──────────────────────────────────────
        order_amount = data.get("order_amount")
        if order_amount is None:
            return Response(
                {"error": "order_amount is required (in smallest currency unit, e.g. paise)."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        try:
            order_amount = int(order_amount)
        except (TypeError, ValueError):
            return Response(
                {"error": "order_amount must be an integer."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        # ── call Pine Labs ───────────────────────────────────────────────
        try:
            client = PineLabsClient()
            result = client.discover_offers(
                order_amount_value=order_amount,
                currency=data.get("currency", "INR"),
                bin=data.get("bin", ""),
                card_number=data.get("card_number", ""),
                customer_id=data.get("customer_id", ""),
            )
            return Response(result, status=drf_status.HTTP_200_OK)

        except ValueError as exc:
            # Missing credentials in settings
            return Response(
                {"error": str(exc)},
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        except PineLabsAPIError as exc:
            return Response(
                {"error": "Pine Labs API error", "detail": exc.detail},
                status=exc.status_code,
            )
        except Exception as exc:
            return Response(
                {"error": f"Unexpected error: {exc}"},
                status=drf_status.HTTP_502_BAD_GATEWAY,
            )


class BrandOfferDiscoveryView(APIView):
    """
    POST /api/inventory/offers/discover-brand/

    Proxies to Pine Labs Offer Discovery API for **Brand EMI** offers.
    Unlike bank EMI, this requires product_details (per-product amounts
    and coupon discounts). The response structure also differs.

    Expected JSON body:
    {
        "order_amount": 1200000,
        "currency": "INR",
        "product_details": [
            {
                "product_code": "xyz",
                "product_amount": {"currency": "INR", "value": 1200000},
                "product_coupon_discount_amount": {"currency": "INR", "value": 0}
            }
        ],
        "cart_coupon_discount": 0,
        "bin": "60100000",
        "card_number": "4000000000000000",
        "customer_id": "cust-..."
    }
    """

    def post(self, request):
        data = request.data

        # ── validate required fields ─────────────────────────────────────
        order_amount = data.get("order_amount")
        if order_amount is None:
            return Response(
                {"error": "order_amount is required (in smallest currency unit, e.g. paise)."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        try:
            order_amount = int(order_amount)
        except (TypeError, ValueError):
            return Response(
                {"error": "order_amount must be an integer."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        product_details = data.get("product_details")
        if not product_details or not isinstance(product_details, list):
            return Response(
                {"error": "product_details is required and must be a non-empty list."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        # Validate each product entry
        for idx, product in enumerate(product_details):
            if not product.get("product_code"):
                return Response(
                    {"error": f"product_details[{idx}].product_code is required."},
                    status=drf_status.HTTP_400_BAD_REQUEST,
                )
            if not product.get("product_amount"):
                return Response(
                    {"error": f"product_details[{idx}].product_amount is required."},
                    status=drf_status.HTTP_400_BAD_REQUEST,
                )

        # ── call Pine Labs ───────────────────────────────────────────────
        try:
            client = PineLabsClient()
            currency = data.get("currency", "INR")

            # Build product_details payload in the Pine Labs format
            formatted_products = []
            for product in product_details:
                entry = {
                    "product_code": product["product_code"],
                    "product_amount": product["product_amount"],
                }
                if "product_coupon_discount_amount" in product:
                    entry["product_coupon_discount_amount"] = product["product_coupon_discount_amount"]
                formatted_products.append(entry)

            result = client.discover_brand_offers(
                order_amount_value=order_amount,
                product_details=formatted_products,
                currency=currency,
                cart_coupon_discount_value=data.get("cart_coupon_discount"),
                bin=data.get("bin", ""),
                card_number=data.get("card_number", ""),
                customer_id=data.get("customer_id", ""),
            )
            return Response(result, status=drf_status.HTTP_200_OK)

        except ValueError as exc:
            return Response(
                {"error": str(exc)},
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        except PineLabsAPIError as exc:
            return Response(
                {"error": "Pine Labs API error", "detail": exc.detail},
                status=exc.status_code,
            )
        except Exception as exc:
            return Response(
                {"error": f"Unexpected error: {exc}"},
                status=drf_status.HTTP_502_BAD_GATEWAY,
            )