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
    def perform_create(self, serializer): # perform_create is then called by the create()

        serializer.save(
        last_modified_by_username=self.request.user.username
        )

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

    # @action(methods=["get"], url_path="invoicegenerate") :


    
class InvoiceItemViewSet(viewsets.ModelViewSet) :
    queryset = InvoiceItem.objects.all()#.order_by("-created_at")
    serializer_class=InvoiceItemSerializer

    # def perform_create(self, serializer): # perform_create is then called by the create()

    #     serializer.save(
    #     last_modified_by_username=self.request.user.username
    #     )

   