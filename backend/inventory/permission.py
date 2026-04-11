from rest_framework.permissions import BasePermission

class IsOwnerOrAdmin(BasePermission): #write now I am not using it, just for learning, it is an object level permission.
    """
    - Admin can do anything
    - Normal users can only modify objects they last modified
    """

    def has_object_permission(self, request, view, obj):
        # Admin can access everything
        if request.user.is_staff:
            return True

        # SAFE methods (GET, HEAD, OPTIONS) are allowed
        if request.method in ["GET", "HEAD", "OPTIONS"]:
            return True

        # Only allow modification if user is the owner
        return obj.last_modified_by == request.user
