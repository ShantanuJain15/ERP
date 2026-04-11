from django.urls import include, path
from rest_framework.authtoken.views import obtain_auth_token
from rest_framework.routers import DefaultRouter

from .views import ProductViewSet, CustomerViewSet

app_name = "inventory"

router = DefaultRouter()
router.register("products", ProductViewSet, basename="product")
router.register("customers", CustomerViewSet, basename="customer")
# router.register("acs", ACViewSet, basename="ac")

urlpatterns = [
    path("token/", obtain_auth_token, name="token_auth"), # this is obselete as I have remove TokenAuthentication from the default authentication classes in settings.py, and I am using JWTAuthentication instead,
    path("", include(router.urls)),
]


