# project/urls.py
from django.contrib.auth import views as auth_views
from django.urls import path
from django.contrib.auth.decorators import login_required
from . import views

app_name = "accounts"

urlpatterns = [
    path("login/", auth_views.LoginView.as_view(), name="login"),
    # path("logout/", login_required(views.logged_out_view), name="logout"),
    path("logout/",auth_views.LogoutView.as_view(template_name="registration/logged_out.html"),name="logout")
]