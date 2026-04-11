from django.contrib import messages
from django.http import JsonResponse
from django.shortcuts import redirect, render , HttpResponse
from django.shortcuts import get_object_or_404
from .models import MetaDataBlob
from django.contrib.auth.decorators import login_required
# Create your views here.
@login_required
def dummy_upload(request,file_name,file_path="/dummy/path"):
    MetaDataBlob.objects.create(file_name=file_name, data={"key": "value"}, file_path=file_path)
    return HttpResponse("This is a dummy upload view")

@login_required
def upload(request):
    if request.method == "POST":
        uploaded_file = request.FILES.get("file")

        if not uploaded_file:
            return HttpResponse("No file uploaded", status=400)

        print("File name:", uploaded_file.name)
        print("File size:", uploaded_file.size)
        file_name = uploaded_file.name
        file_path = f"/uploads/{uploaded_file.name}"
        MetaDataBlob.objects.create(
            owner=request.user, 
            file_name=file_name,
            data={"key": "value"},
            file_path=file_path
        )

        return HttpResponse("This is an upload view")

    return HttpResponse("Invalid request", status=400)



from rest_framework.parsers import FileUploadParser,MultiPartParser
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

class FileUploadView(APIView):
    parser_classes = (MultiPartParser, ) # comma is there becaue it makes it a tuple, in APIView(get_parsers) it expects a tuple
    # authentication_classes=[]
    permission_classes = [IsAuthenticated]

    def post(self, request, format='xlsx'):
        up_file = request.FILES['file']
        # up_file = request.data
        if not up_file:
            return Response("No file uploaded", status=status.HTTP_400_BAD_REQUEST)
        # print("File name:", up_file.name)
        print("File size:", up_file.size)
        file_name = up_file.name
        file_path = f"/uploads/{up_file.name}"
        MetaDataBlob.objects.create(
            owner=request.user, 
            file_name=file_name,
            data={"key": "value"},
            file_path=file_path
        )

        # ...
        # do some stuff with uploaded file
        # ...


        messages.success(
            request,
            f"File '{up_file.name}' uploaded successfully!",
            extra_tags="upload"
        )
        return redirect('blob:home')



@login_required
def list_blobs(request):
    blobs = MetaDataBlob.objects.filter(owner=request.user)

    return JsonResponse(
        {
            "blobs": [
                {
                    "id": blob.id,
                    "path": blob.file_path,
                    "name": blob.file_name,
                    "data": blob.data,
                    "created_at": blob.created_at,
                    "updated_at": blob.updated_at,
                }
                for blob in blobs
            ]
        }
    )


from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
@login_required
def list_blobs_pagination(request):#,limit=5,offset=0):
    blobs = MetaDataBlob.objects.filter(owner=request.user).order_by('id')
    # page_number = request.GET.get('page')
    paginator=Paginator(blobs,5)

    page_number = request.GET.get('page',1)
    try:
        page_obj = paginator.get_page(page_number)
    except PageNotAnInteger:
        page_obj = paginator.page(1)
    except EmptyPage:
        page_obj = paginator.page(paginator.num_pages)
    
    return render(request, "blob/home.html", {
            "page_obj": page_obj
        })


def dowload_blob(request, id):
    try : 
        blob_file=get_object_or_404(MetaDataBlob, id=id,owner=request.user)
        
    # blob_file=id

    # now add the download logic here



    # see where this file goes
    except Exception as e:
        messages.error(request, "Requested file does not exist.", extra_tags="download")
        return redirect("blob:home")

    messages.success(request, f"Preparing download: {blob_file.file_name}",extra_tags="download")

    return redirect("blob:home")

from .utils import get_user_blobs_page
@login_required
def home(request):
    page_obj = get_user_blobs_page(request)

    return render(request, "blob/home.html", {
        "page_obj": page_obj
    })