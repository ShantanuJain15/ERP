
from django.contrib.auth.decorators import login_required
from django.urls import path
from . import views



app_name = 'blob' #resgerinter app name(namespace)
urlpatterns = [
    path('dummy_upload/<str:file_name>/', login_required(views.dummy_upload), name='dummy_upload'),
    # path('upload/', login_required(views.upload), name='upload'),
    path('upload/', views.FileUploadView.as_view(), name='upload'),
    path('list_blobs/', login_required(views.list_blobs), name='list_blobs'),
    path('list_blobs_page/', login_required(views.list_blobs_pagination), name='list_blobs_pagination'),
    path('download/<int:id>/', views.dowload_blob, name='download_blob'),
    path('', views.home, name='home'),
]